import { useMemo } from "react";
import { create } from "zustand";

import { getDatabase } from "../database/database";
import { getSeederJobOrders } from "../seeders/jobOrders";
import { JobOrderRepository } from "../repositories/JobOrderRepository";
import { PostServiceRepository } from "../repositories/PostServiceRepository";
import { USE_SEEDER_AUTH } from "../services/AuthService";
import { SessionExpiredError, syncService, type SyncResult } from "../services/SyncService";
import type { JobOrder, PostServiceRecord } from "../types/bms";
import { isAssignedTo } from "../utils/assignments";
import { useUserStore } from "./userStore";

type JobOrdersState = {
  jobOrders: JobOrder[];
  /** Submitted post-service records, keyed by job order id */
  postServiceRecords: Record<string, PostServiceRecord>;
  /** Result of the last sync with the server (null before the first one, or with seeder data) */
  lastSync: SyncResult | null;
  /** Why the last sync failed, if it did */
  syncError: string | null;
  /** Upload queued records, pull the latest job orders into SQLite, then reload the screens from SQLite. */
  refresh: () => Promise<void>;
  savePostServiceRecord: (record: PostServiceRecord) => Promise<void>;
};

/** A job order with a submitted post-service record is done. */
function withRecordFlags(jobOrders: JobOrder[], records: Record<string, PostServiceRecord>): JobOrder[] {
  return jobOrders.map((jo) => {
    const record = records[jo.id];
    if (!record) return jo;
    return { ...jo, postServiceFormSubmitted: true, status: record.serviceCompleted ? "COMPLETED" : jo.status };
  });
}

/**
 * One shared source of job orders for Home, Job Orders and Post Service.
 * SQLite (bms_mobile.db) is the source of truth; this store is the in-memory copy the screens render.
 */
export const useJobOrdersStore = create<JobOrdersState>((set, get) => ({
  jobOrders: [],
  postServiceRecords: {},
  lastSync: null,
  syncError: null,

  refresh: async () => {
    const db = await getDatabase();

    if (USE_SEEDER_AUTH) {
      // Seeder accounts have no server data; show the seeder job orders instead.
      await db.withExclusiveTransactionAsync(async (txn) => {
        await new JobOrderRepository(txn).reconcileSnapshot(getSeederJobOrders());
      });
    } else {
      // Offline or failed syncs keep the last cached snapshot.
      try {
        set({ lastSync: await syncService.sync(), syncError: null });
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          await useUserStore.getState().expireSession();
          return;
        }
        console.warn("[JobOrders] Sync failed; showing cached job orders", error);
        set({ syncError: error instanceof Error ? error.message : String(error) });
      }
    }

    const [jobOrders, postServiceRecords] = await Promise.all([
      new JobOrderRepository(db).getJobOrders(),
      new PostServiceRepository(db).getRecords(),
    ]);
    set({ postServiceRecords, jobOrders: withRecordFlags(jobOrders, postServiceRecords) });
  },

  savePostServiceRecord: async (record) => {
    // Saved locally first (syncPending = 1), so the form is never lost when offline.
    await new PostServiceRepository(await getDatabase()).saveRecord(record);
    const postServiceRecords = { ...get().postServiceRecords, [record.jobOrderId]: record };
    set({ postServiceRecords, jobOrders: withRecordFlags(get().jobOrders, postServiceRecords) });
    // Upload now in the background; if offline it stays queued for the next sync.
    if (!USE_SEEDER_AUTH) void get().refresh();
  },
}));

/** Job orders the signed-in user is assigned to (as driver or helper). Use this in screens. */
export function useMyJobOrders(): JobOrder[] {
  const all = useJobOrdersStore((s) => s.jobOrders);
  const user = useUserStore((s) => s.user);
  return useMemo(() => (user ? all.filter((jo) => isAssignedTo(jo, user)) : []), [all, user]);
}
