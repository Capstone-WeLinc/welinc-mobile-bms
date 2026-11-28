import type { SQLiteDatabase } from "expo-sqlite";

import type { NotificationRow } from "../database/tables";
import type { AppNotification, NotificationTextPart, NotificationType, ProfileField } from "../types/bms";
import { parseJson } from "./json";

const PROFILE_FIELDS: ProfileField[] = ["name", "email", "contact", "password"];

export class NotificationRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  /** The user's notifications, newest first. */
  async getForUser(userId: string): Promise<AppNotification[]> {
    const rows = await this.db.getAllAsync<NotificationRow>(
      "SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC",
      userId,
    );
    return rows.map(toNotification);
  }

  /**
   * Replace the user's cached notifications with a complete snapshot.
   * A notification the user already read on this phone stays read.
   * Run inside a transaction.
   */
  async reconcileForUser(userId: string, notifications: AppNotification[]): Promise<void> {
    try {
      await this.db.execAsync("CREATE TEMP TABLE IF NOT EXISTS incoming_notification_ids (id TEXT PRIMARY KEY)");
      await this.db.execAsync("DELETE FROM incoming_notification_ids");

      for (const n of notifications) {
        await this.db.runAsync(
          `INSERT INTO notifications
            (id, userId, type, actorName, message, createdAt, read, jobOrderId, driversOnly, readSyncPending, profileField)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(userId, id) DO UPDATE SET
             type = excluded.type,
             actorName = excluded.actorName,
             message = excluded.message,
             createdAt = excluded.createdAt,
             read = MAX(notifications.read, excluded.read),
             jobOrderId = excluded.jobOrderId,
             driversOnly = excluded.driversOnly,
             profileField = excluded.profileField`,
          n.id,
          userId,
          n.type,
          n.actorName,
          JSON.stringify(n.message),
          n.createdAt,
          n.read ? 1 : 0,
          n.jobOrderId ?? null,
          n.driversOnly ? 1 : 0,
          n.profileField ?? null,
        );
        await this.db.runAsync("INSERT OR IGNORE INTO incoming_notification_ids (id) VALUES (?)", n.id);
      }

      await this.db.runAsync(
        "DELETE FROM notifications WHERE userId = ? AND id NOT IN (SELECT id FROM incoming_notification_ids)",
        userId,
      );
    } catch (error) {
      console.error(`[SQLite] Notification reconciliation failed for ${userId}`, error);
      throw error;
    }
  }

  /**
   * Replace only one source's notifications (spec bms/0023): the rows whose id starts with `prefix`
   * (`account-`, `bms-` or `local-`). Other sources' rows are left alone, so one source failing never
   * removes the others. Read flags stay; phone-built (`local-`) notices keep the time they first appeared.
   * Run inside a transaction.
   */
  async reconcileSource(userId: string, prefix: string, notifications: AppNotification[]): Promise<void> {
    try {
      await this.db.execAsync("CREATE TEMP TABLE IF NOT EXISTS incoming_notification_ids (id TEXT PRIMARY KEY)");
      await this.db.execAsync("DELETE FROM incoming_notification_ids");

      for (const n of notifications) {
        if (!n.id.startsWith(prefix)) continue;
        await this.db.runAsync(
          `INSERT INTO notifications
            (id, userId, type, actorName, message, createdAt, read, jobOrderId, driversOnly, readSyncPending, profileField)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
           ON CONFLICT(userId, id) DO UPDATE SET
             type = excluded.type,
             actorName = excluded.actorName,
             message = excluded.message,
             createdAt = CASE WHEN notifications.id LIKE 'local-%' THEN notifications.createdAt ELSE excluded.createdAt END,
             read = MAX(notifications.read, excluded.read),
             jobOrderId = excluded.jobOrderId,
             driversOnly = excluded.driversOnly,
             profileField = excluded.profileField`,
          n.id,
          userId,
          n.type,
          n.actorName,
          JSON.stringify(n.message),
          n.createdAt,
          n.read ? 1 : 0,
          n.jobOrderId ?? null,
          n.driversOnly ? 1 : 0,
          n.profileField ?? null,
        );
        await this.db.runAsync("INSERT OR IGNORE INTO incoming_notification_ids (id) VALUES (?)", n.id);
      }

      await this.db.runAsync(
        "DELETE FROM notifications WHERE userId = ? AND id LIKE ? AND id NOT IN (SELECT id FROM incoming_notification_ids)",
        userId,
        `${prefix}%`,
      );
    } catch (error) {
      console.error(`[SQLite] Notification reconciliation (${prefix}) failed for ${userId}`, error);
      throw error;
    }
  }

  /** BMS notices read on the phone that the server hasn't been told about yet. */
  async getPendingBmsReads(userId: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      "SELECT id FROM notifications WHERE userId = ? AND readSyncPending = 1 AND id LIKE 'bms-%'",
      userId,
    );
    return rows.map((row) => row.id);
  }

  /** The server knows these were read (or they are gone there). */
  async clearPendingReads(userId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.db.runAsync("UPDATE notifications SET readSyncPending = 0 WHERE userId = ? AND id = ?", userId, id);
    }
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE notifications SET read = 1, readSyncPending = 1 WHERE userId = ? AND id = ? AND read = 0",
      userId,
      id,
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE notifications SET read = 1, readSyncPending = 1 WHERE userId = ? AND read = 0",
      userId,
    );
  }
}

function toNotification(row: NotificationRow): AppNotification {
  const notification: AppNotification = {
    id: row.id,
    type: row.type as NotificationType,
    actorName: row.actorName,
    message: parseJson<NotificationTextPart[]>(row.message, []),
    createdAt: row.createdAt,
    read: row.read === 1,
  };
  if (row.jobOrderId) notification.jobOrderId = row.jobOrderId;
  if (row.driversOnly === 1) notification.driversOnly = true;
  if (row.profileField && PROFILE_FIELDS.includes(row.profileField as ProfileField)) {
    notification.profileField = row.profileField as ProfileField;
  }
  return notification;
}
