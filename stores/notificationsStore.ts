import { create } from "zustand";

import { getDatabase } from "../database/database";
import { getSeederNotifications } from "../seeders/notifications";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { fetchAccountNotifications } from "../services/AccountNotificationsService";
import { USE_SEEDER_AUTH } from "../services/AuthService";
import { fetchBmsNotifications, sendRead, sendReadAll } from "../services/BmsNotificationsService";
import type { AppNotification, TeamRole, TeamMember } from "../types/bms";
import { buildJobOrderNotices } from "../utils/jobOrderNotices";
import { useJobOrdersStore } from "./jobOrdersStore";

type NotificationsState = {
  /** Signed-in user the current list belongs to */
  user: TeamMember | null;
  /** Each user's notifications, so read/unread state stays separate per account */
  byUser: Record<string, AppNotification[]>;
  /** Switch to this user's notifications (call on sign-in / sign-out, after job orders are loaded). */
  loadForUser: (user: TeamMember | null) => Promise<void>;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const EMPTY: AppNotification[] = [];

function seederNotificationsFor(user: TeamMember): AppNotification[] {
  return getSeederNotifications(user, useJobOrdersStore.getState().jobOrders);
}

/**
 * Pull this user's notifications into SQLite. Read flags already set on this phone are kept.
 * Seeder sign-in uses the seeder list. A real sign-in (spec bms/0023) combines three sources, each
 * replaced on its own so one failing never removes the others:
 * - `account-`: the account's own activity from shared auth (spec 0020), so dates match the portal;
 * - `bms-`: job order notices from `GET /bms/notifications`, worded by the app;
 * - `local-`: reminders and "marked completed", built from the job orders on the phone.
 */
async function syncForUser(user: TeamMember): Promise<void> {
  const db = await getDatabase();
  if (USE_SEEDER_AUTH) {
    const incoming = seederNotificationsFor(user);
    await db.withExclusiveTransactionAsync(async (txn) => {
      await new NotificationRepository(txn).reconcileForUser(user.id, incoming);
    });
    return;
  }

  // Tell the server about reads made offline first, so they don't come back unread.
  const repository = new NotificationRepository(db);
  const pending = await repository.getPendingBmsReads(user.id);
  const sent: string[] = [];
  for (const id of pending) if (await sendRead(id)) sent.push(id);
  if (sent.length) await repository.clearPendingReads(user.id, sent);

  const jobOrders = useJobOrdersStore.getState().jobOrders;
  const [account, bms] = await Promise.allSettled([fetchAccountNotifications(user), fetchBmsNotifications(user, jobOrders)]);
  if (account.status === "rejected") console.warn("[Notifications] Account notifications unavailable; keeping the saved ones", account.reason);
  if (bms.status === "rejected") console.warn("[Notifications] Job order notifications unavailable; keeping the saved ones", bms.reason);
  const local = buildJobOrderNotices(user, jobOrders);

  await db.withExclusiveTransactionAsync(async (txn) => {
    const sources = new NotificationRepository(txn);
    if (account.status === "fulfilled") await sources.reconcileSource(user.id, "account-", account.value);
    if (bms.status === "fulfilled") await sources.reconcileSource(user.id, "bms-", bms.value);
    await sources.reconcileSource(user.id, "local-", local);
  });
}

/** Sends one read to the server in the background; if it fails it stays pending for the next sync. */
function sendReadInBackground(userId: string, ids: string[], all: boolean) {
  if (USE_SEEDER_AUTH || !ids.length) return;
  void (async () => {
    const ok = all ? await sendReadAll() : await sendRead(ids[0]);
    if (ok) await new NotificationRepository(await getDatabase()).clearPendingReads(userId, ids);
  })().catch((error) => console.warn("[Notifications] Read not sent yet; will retry on the next sync", error));
}

async function readForUser(userId: string): Promise<AppNotification[]> {
  return new NotificationRepository(await getDatabase()).getForUser(userId);
}

let refreshing: Promise<void> | null = null;

export const useNotificationsStore = create<NotificationsState>((set, get) => {
  /** Apply a change to the current user's list in memory. */
  const updateCurrent = (change: (list: AppNotification[]) => AppNotification[]) => {
    const { user, byUser } = get();
    if (!user) return;
    set({ byUser: { ...byUser, [user.id]: change(byUser[user.id] ?? EMPTY) } });
  };

  /** Write a change to SQLite in the background; the UI already shows it. */
  const persist = (write: (repository: NotificationRepository) => Promise<void>) => {
    void getDatabase()
      .then((db) => write(new NotificationRepository(db)))
      .catch((error) => console.error("[SQLite] Failed to save notification read state", error));
  };

  return {
    user: null,
    byUser: {},

    loadForUser: async (user) => {
      if (!user) {
        set({ user: null });
        return;
      }
      set({ user });
      await syncForUser(user);
      const list = await readForUser(user.id);
      // Ignore the result if a different user signed in meanwhile.
      if (get().user?.id !== user.id) return;
      set({ byUser: { ...get().byUser, [user.id]: list } });
    },

    refresh: () => {
      // Concurrent refreshes (timer, reconnect, pull to refresh) share one run.
      if (!refreshing) {
        refreshing = (async () => {
          // Job orders first, so notices are worded and built from the newest ones (spec bms/0023).
          await useJobOrdersStore.getState().refresh();
          const { user } = get();
          if (!user) return;
          await syncForUser(user);
          const list = await readForUser(user.id);
          if (get().user?.id !== user.id) return;
          set({ byUser: { ...get().byUser, [user.id]: list } });
        })().finally(() => {
          refreshing = null;
        });
      }
      return refreshing;
    },

    markRead: (id) => {
      const { user } = get();
      if (!user) return;
      const wasUnread = (get().byUser[user.id] ?? EMPTY).some((n) => n.id === id && !n.read);
      updateCurrent((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      // Saved with readSyncPending = 1; a BMS notice is then sent to the server (spec bms/0023).
      persist(async (repository) => {
        await repository.markRead(user.id, id);
        if (wasUnread && id.startsWith("bms-")) sendReadInBackground(user.id, [id], false);
      });
    },

    markAllRead: () => {
      const { user } = get();
      if (!user) return;
      const unreadBms = (get().byUser[user.id] ?? EMPTY).filter((n) => !n.read && n.id.startsWith("bms-")).map((n) => n.id);
      updateCurrent((list) => list.map((n) => ({ ...n, read: true })));
      persist(async (repository) => {
        await repository.markAllRead(user.id);
        sendReadInBackground(user.id, unreadBms, true);
      });
    },
  };
});

/** The signed-in user's notifications. */
export const useMyNotifications = () =>
  useNotificationsStore((s) => (s.user ? (s.byUser[s.user.id] ?? EMPTY) : EMPTY));

/** Post-service notifications are for drivers only (extra safety on top of per-user lists). */
export function isVisibleTo(notification: AppNotification, role: TeamRole | undefined): boolean {
  return !notification.driversOnly || role === "driver";
}

/** Number of unread notifications the signed-in user can see, for the bell badge. */
export const useUnreadCount = () =>
  useNotificationsStore((s) => {
    const list = s.user ? (s.byUser[s.user.id] ?? EMPTY) : EMPTY;
    return list.filter((n) => !n.read && isVisibleTo(n, s.user?.role)).length;
  });
