import axios, { type AxiosInstance } from "axios";

import { clearDatabase, getDatabase } from "../database/database";
import { ADD_ONS } from "../seeders/addOns";
import { JobOrderRepository } from "../repositories/JobOrderRepository";
import { PostServiceRepository } from "../repositories/PostServiceRepository";
import type { JobOrder, PostServiceRecord } from "../types/bms";
import { authService, getApiErrorMessage } from "./AuthService";
import { SessionExpiredError } from "./mobileAuthRefresh";

export { SessionExpiredError };

/**
 * The BMS backend (welinc-backend-bms) has no driver/helper routes for job orders and
 * post-service yet; they are planned in their own BMS spec. Until they exist, the sync
 * does nothing in real sign-in mode and the screens show what is saved on the phone.
 * Turn this on, and check the two paths below, when those routes are merged.
 */
const TEAM_JOB_ORDER_ROUTES_READY = false;
/** Planned through the gateway: the signed-in team member's distributed job orders. */
const JOB_ORDERS_PATH = "/bms/job-orders/mine";
/** Planned through the gateway: the driver submits a job order's post-service form. */
const postServicePath = (jobOrderId: string) => `/bms/job-orders/${encodeURIComponent(jobOrderId)}/post-service`;

export type SyncResult = {
  /**
   * "offline": the server could not be reached; the screens show the SQLite cache.
   * "unavailable": the BMS backend has no routes for this yet; nothing was sent or downloaded.
   */
  status: "synchronized" | "offline" | "unavailable";
  /** Last time the job orders were downloaded successfully (ISO), or null if never. */
  lastSyncedAt: string | null;
  /** Post-service records still waiting to be accepted by the server. */
  pendingUploads: number;
  /** Why some records were not accepted, one message per record. */
  uploadErrors: string[];
};

const LAST_SYNC_KEY = "lastSuccessfulSyncAt";
const OWNER_KEY = "ownerUserId";

function isOffline(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** The interceptor already tried a refresh; this means the person must sign in again. */
function isSessionExpired(error: unknown): boolean {
  return error instanceof SessionExpiredError || (axios.isAxiosError(error) && error.response?.status === 401);
}

/** The record as the BMS backend will expect it. Add-ons are sent by name, the same names the web catalog uses. */
function toUploadBody(record: PostServiceRecord) {
  return {
    serviceCompleted: record.serviceCompleted,
    arrivalTime: record.arrivalTime,
    addOns: record.addOnKeys.map((key) => ADD_ONS.find((addOn) => addOn.key === key)?.label ?? key),
    paymentMethod: record.paymentMethod,
    addOnPayment: record.addOnPayment,
    completionNotes: record.completionNotes,
    issueReported: record.issueReported,
    issueDetails: record.issueDetails,
    submittedAt: record.submittedAt,
  };
}

function isJobOrder(value: unknown): value is JobOrder {
  if (!value || typeof value !== "object") return false;
  const jo = value as Record<string, unknown>;
  return (
    typeof jo.id === "string" &&
    typeof jo.jobOrderNumber === "string" &&
    typeof jo.date === "string" &&
    ["PENDING", "ONGOING", "COMPLETED"].includes(String(jo.status)) &&
    Array.isArray(jo.helperIds) &&
    Array.isArray(jo.charges)
  );
}

/**
 * The booking's down payment from the server. The BMS booking service stores it as
 * `downpayment` (decimal text, or null when none); a number is accepted too. Returns 0 when none.
 */
function readDownPayment(jobOrder: JobOrder): number {
  const fields = jobOrder as unknown as Record<string, unknown>;
  const raw = fields.downPayment ?? fields.downpayment;
  const amount = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : 0;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * Two-way sync between bms_mobile.db and the BMS backend, through the suite gateway:
 * 1. upload post-service records saved offline (syncPending = 1),
 * 2. download the team member's job orders and replace the local snapshot.
 *
 * Screens always read from SQLite, so the app works the same online and offline.
 */
class SyncService {
  private inFlight: Promise<SyncResult> | null = null;

  /** authService's client adds the access token and refreshes it on a 401. */
  private get api(): AxiosInstance {
    return authService.client;
  }

  /** Sync now. Calls made while a sync is running share it. Throws SessionExpiredError on 401. */
  sync(): Promise<SyncResult> {
    if (!this.inFlight) {
      this.inFlight = this.perform().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /**
   * Call before loading data for a newly signed-in user. If a different user
   * used this phone before, their cached data is removed.
   */
  async prepareFor(userId: string): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = ?", OWNER_KEY);
    if (row && row.value !== userId) {
      const pending = await new PostServiceRepository(db).getPendingRecords();
      if (pending.length) {
        console.warn(`[Sync] Discarding ${pending.length} unsent post-service record(s) of the previous user`);
      }
      await clearDatabase();
    }
    await db.runAsync(
      `INSERT INTO sync_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      OWNER_KEY,
      userId,
    );
  }

  async getLastSyncedAt(): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = ?", LAST_SYNC_KEY);
    return row?.value ?? null;
  }

  private async perform(): Promise<SyncResult> {
    const db = await getDatabase();
    const records = new PostServiceRepository(db);

    if (!TEAM_JOB_ORDER_ROUTES_READY) {
      // Nothing to call yet: forms stay queued on the phone (syncPending = 1) until the routes exist.
      return {
        status: "unavailable",
        lastSyncedAt: await this.getLastSyncedAt(),
        pendingUploads: (await records.getPendingRecords()).length,
        uploadErrors: [],
      };
    }

    // 1. Upload first, so the snapshot downloaded next already includes them.
    const uploadErrors: string[] = [];
    for (const record of await records.getPendingRecords()) {
      try {
        await this.api.put(postServicePath(record.jobOrderId), toUploadBody(record));
        await records.markSynced(record.jobOrderId);
      } catch (error) {
        if (isSessionExpired(error)) throw new SessionExpiredError();
        if (isOffline(error)) return this.offlineResult();
        // Kept queued: e.g. the office has not distributed the job order yet. Retried on the next sync.
        const message = getApiErrorMessage(error);
        console.warn(`[Sync] Post-service for job order ${record.jobOrderId} not accepted yet: ${message}`);
        uploadErrors.push(message);
      }
    }

    // 2. Download the current job orders.
    let jobOrders: JobOrder[];
    try {
      const response = await this.api.get<{ jobOrders?: unknown }>(JOB_ORDERS_PATH);
      if (!Array.isArray(response.data?.jobOrders)) throw new Error("The server returned an invalid job order list.");
      jobOrders = response.data.jobOrders.filter(isJobOrder).map((jo) => ({ ...jo, downPayment: readDownPayment(jo) }));
    } catch (error) {
      if (isSessionExpired(error)) throw new SessionExpiredError();
      if (isOffline(error)) return this.offlineResult(uploadErrors);
      throw new Error(getApiErrorMessage(error, "Unable to download job orders."));
    }

    const syncedAt = new Date().toISOString();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await new JobOrderRepository(txn).reconcileSnapshot(jobOrders, syncedAt);
      await txn.runAsync(
        `INSERT INTO sync_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        LAST_SYNC_KEY,
        syncedAt,
      );
    });

    const pendingUploads = (await records.getPendingRecords()).length;
    console.info(`[Sync] ${jobOrders.length} job orders downloaded, ${pendingUploads} post-service record(s) still queued`);
    return { status: "synchronized", lastSyncedAt: syncedAt, pendingUploads, uploadErrors };
  }

  private async offlineResult(uploadErrors: string[] = []): Promise<SyncResult> {
    const db = await getDatabase();
    const pendingUploads = (await new PostServiceRepository(db).getPendingRecords()).length;
    console.info("[Sync] Server unreachable; using the local SQLite cache");
    return { status: "offline", lastSyncedAt: await this.getLastSyncedAt(), pendingUploads, uploadErrors };
  }
}

export const syncService = new SyncService();
