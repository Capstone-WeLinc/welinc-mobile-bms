import { create } from "zustand";

import { getDatabase } from "../database/database";
import { getSeederNotifications } from "../seeders/notifications";
import { NotificationRepository } from "../repositories/NotificationRepository";
import type { AppNotification, TeamRole, TeamMember } from "../types/bms";
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

/** Pull this user's notifications into SQLite. Read flags already set on this phone are kept. */
async function syncForUser(user: TeamMember): Promise<void> {
  const db = await getDatabase();
  // TODO: fetch this user's notifications from the BMS backend instead of the seeder data.
  const incoming = seederNotificationsFor(user);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await new NotificationRepository(txn).reconcileForUser(user.id, incoming);
  });
}

async function readForUser(userId: string): Promise<AppNotification[]> {
  return new NotificationRepository(await getDatabase()).getForUser(userId);
}

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

    refresh: async () => {
      const { user } = get();
      if (!user) return;
      await syncForUser(user);
      const list = await readForUser(user.id);
      if (get().user?.id !== user.id) return;
      set({ byUser: { ...get().byUser, [user.id]: list } });
    },

    markRead: (id) => {
      const { user } = get();
      if (!user) return;
      updateCurrent((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      // Saved with readSyncPending = 1. TODO: tell the backend this notification was read.
      persist((repository) => repository.markRead(user.id, id));
    },

    markAllRead: () => {
      const { user } = get();
      if (!user) return;
      updateCurrent((list) => list.map((n) => ({ ...n, read: true })));
      persist((repository) => repository.markAllRead(user.id));
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
