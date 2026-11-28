import axios, { type AxiosInstance } from "axios";

import { clearDatabase, getDatabase } from "../database/database";
import { ADD_ONS } from "../seeders/addOns";
import { fromWebAddOnPayment, fromWebPaymentMethod } from "../seeders/payments";
import { JobOrderRepository } from "../repositories/JobOrderRepository";
import { PostServiceRepository } from "../repositories/PostServiceRepository";
import type { JobOrder, PostServiceRecord } from "../types/bms";
import { authService, getApiErrorMessage } from "./AuthService";
import { SessionExpiredError } from "./mobileAuthRefresh";

export { SessionExpiredError };

/** Dispatch: the signed-in driver's or helper's job orders (spec bms/0022). */
const JOB_ORDERS_PATH = "/bms/job-order/mine";
/** Completion: for each of the driver's bookings, whether a form was sent and whether the office finalized it. */
const POST_SERVICE_STATUS_PATH = "/bms/post-service/mine";
/** Completion: the driver sends a job order's post-service form (the job order id is the booking UUID). */
const postServicePath = (jobOrderId: string) => `/bms/post-service/mine/${encodeURIComponent(jobOrderId)}`;

const FINALIZED_MESSAGE = "Finalized by office. This record can no longer be changed.";

export type SyncResult = {
  /** "offline": the server could not be reached; the screens show the SQLite cache. */
  status: "synchronized" | "offline";
  /** Last time the job orders were downloaded successfully (ISO), or null if never. */
  lastSyncedAt: string | null;
  /** Post-service records still waiting to be accepted by the server. */
  pendingUploads: number;
  /** Why some records were not accepted, one message per record. */
  uploadErrors: string[];
};

export type SyncOptions = {
  /** Drivers also download post-service status; helpers have no post-service form. */
  isDriver: boolean;
};

type PostServiceStatus = { bookingUuid: string; submitted: boolean; finalized: boolean; version: string | null };

/** The record as completion answers it (the web's Post-Service view plus the driver's report). */
type ServerPostService = {
  bookingUuid?: string; postServiceStatus?: string; status?: string; arrivalTime?: string | null;
  additionalMaterials?: string[]; completionNotes?: string | null; issueReported?: boolean; issueDetails?: string | null;
  reportedPaymentMethod?: string | null; reportedAddOnPayment?: string | null; version?: string | null;
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

function errorBody(error: unknown): { status: number; code?: string; current?: ServerPostService } | null {
  if (!axios.isAxiosError(error) || !error.response) return null;
  const data = error.response.data as { code?: unknown; current?: unknown } | undefined;
  return {
    status: error.response.status,
    code: typeof data?.code === "string" ? data.code : undefined,
    current: data?.current && typeof data.current === "object" ? (data.current as ServerPostService) : undefined,
  };
}

/** The record as the BMS backend expects it. Add-ons are sent by name, the same names the web catalog uses. */
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
    baseVersion: record.baseVersion ?? null,
  };
}

/** "2:30 PM" or "14:30" as "14:30"; the web may save either. Falls back to the phone's value. */
function toTime24(value: string | null | undefined, fallback: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(value ?? "").trim());
  if (!match) return fallback;
  let hours = Number(match[1]);
  const half = match[3]?.toUpperCase();
  if (half) hours = (hours % 12) + (half === "PM" ? 12 : 0);
  return hours > 23 ? fallback : `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** The office's version of a record, in the app's fields. What the server doesn't hold keeps the phone's value. */
function fromServer(current: ServerPostService, local: PostServiceRecord): PostServiceRecord {
  const addOnKeys = (current.additionalMaterials ?? []).map((name) => ADD_ONS.find((addOn) => addOn.label === name)?.key ?? name);
  return {
    ...local,
    serviceCompleted: (current.postServiceStatus ?? "Pending Review") !== "Pending Review",
    arrivalTime: toTime24(current.arrivalTime, local.arrivalTime),
    addOnKeys,
    paymentMethod: fromWebPaymentMethod(current.reportedPaymentMethod) ?? local.paymentMethod,
    addOnPayment: addOnKeys.length ? fromWebAddOnPayment(current.reportedAddOnPayment) ?? local.addOnPayment : null,
    completionNotes: current.completionNotes ?? "",
    issueReported: current.issueReported === true,
    issueDetails: current.issueDetails ?? "",
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

function isStatus(value: unknown): value is PostServiceStatus {
  return !!value && typeof value === "object" && typeof (value as PostServiceStatus).bookingUuid === "string";
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
 * Two-way sync between bms_mobile.db and the BMS backend, through the suite gateway (spec bms/0022):
 * 1. upload post-service records saved offline (syncPending = 1, not blocked),
 * 2. download the team member's job orders (and, for drivers, post-service status),
 * 3. replace the local snapshot in one transaction.
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
  sync(options: SyncOptions): Promise<SyncResult> {
    if (!this.inFlight) {
      this.inFlight = this.perform(options).finally(() => {
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

  private async perform({ isDriver }: SyncOptions): Promise<SyncResult> {
    const db = await getDatabase();
    const records = new PostServiceRepository(db);

    // 1. Upload first, so the snapshot downloaded next already includes them. Helpers have none.
    const uploadErrors: string[] = [];
    for (const record of isDriver ? await records.getPendingRecords() : []) {
      try {
        const response = await this.api.put<{ version?: unknown }>(postServicePath(record.jobOrderId), toUploadBody(record));
        const version = typeof response.data?.version === "string" ? response.data.version : null;
        await records.markSynced(record.jobOrderId, record.submittedAt, version);
      } catch (error) {
        if (isSessionExpired(error)) throw new SessionExpiredError();
        if (isOffline(error)) return this.offlineResult(uploadErrors);
        const message = getApiErrorMessage(error);
        const body = errorBody(error);
        if (body?.code === "POST_SERVICE_CHANGED" && body.current) {
          // The office changed it on the web: show the office's version, not queued any more.
          await records.replaceWithOffice(fromServer(body.current, record), record.submittedAt, body.current.version ?? null, message);
        } else if (body?.code === "POST_SERVICE_FINALIZED") {
          await records.markBlocked(record.jobOrderId, record.submittedAt, FINALIZED_MESSAGE);
        } else if (body && (body.status === 400 || body.status === 403)) {
          // Invalid details, or not this person's job: retrying the same form won't help.
          await records.markBlocked(record.jobOrderId, record.submittedAt, message);
        } else {
          // e.g. the job order isn't distributed yet, or the server is down: retried on the next sync.
          await records.markRetrying(record.jobOrderId, record.submittedAt, message);
        }
        console.warn(`[Sync] Post-service for job order ${record.jobOrderId} not accepted: ${message}`);
        uploadErrors.push(message);
      }
    }

    // 2. Download the current job orders, and for drivers the post-service status.
    let jobOrders: JobOrder[];
    let statuses = new Map<string, PostServiceStatus>();
    try {
      const [jobOrderResponse, statusResponse] = await Promise.all([
        this.api.get<{ jobOrders?: unknown }>(JOB_ORDERS_PATH),
        isDriver ? this.api.get<{ items?: unknown }>(POST_SERVICE_STATUS_PATH) : Promise.resolve(null),
      ]);
      if (!Array.isArray(jobOrderResponse.data?.jobOrders)) throw new Error("The server returned an invalid job order list.");
      if (statusResponse) {
        if (!Array.isArray(statusResponse.data?.items)) throw new Error("The server returned an invalid post-service list.");
        statuses = new Map(statusResponse.data.items.filter(isStatus).map((item) => [item.bookingUuid, item]));
      }
      jobOrders = jobOrderResponse.data.jobOrders.filter(isJobOrder).map((jo) => ({
        ...jo,
        downPayment: readDownPayment(jo),
        postServiceFormSubmitted: statuses.get(jo.id)?.submitted === true,
        postServiceLocked: statuses.get(jo.id)?.finalized === true,
      }));
    } catch (error) {
      if (isSessionExpired(error)) throw new SessionExpiredError();
      if (isOffline(error)) return this.offlineResult(uploadErrors);
      throw new Error(getApiErrorMessage(error, "Unable to download job orders."));
    }

    // 3. Replace the snapshot.
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
