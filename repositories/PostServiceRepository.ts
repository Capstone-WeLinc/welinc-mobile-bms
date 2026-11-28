import type { SQLiteDatabase } from "expo-sqlite";

import type { PostServiceRecordRow } from "../database/tables";
import type { AddOnPayment, PaymentMethod, PostServiceRecord } from "../types/bms";
import { parseJson } from "./json";

export class PostServiceRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  /** All saved records, keyed by job order id. */
  async getRecords(): Promise<Record<string, PostServiceRecord>> {
    const rows = await this.db.getAllAsync<PostServiceRecordRow>("SELECT * FROM post_service_records");
    return Object.fromEntries(rows.map((row) => [row.jobOrderId, toRecord(row)]));
  }

  /** Records waiting for the backend: not yet accepted and not stopped (spec bms/0022). */
  async getPendingRecords(): Promise<PostServiceRecord[]> {
    const rows = await this.db.getAllAsync<PostServiceRecordRow>(
      "SELECT * FROM post_service_records WHERE syncPending = 1 AND syncBlocked = 0 ORDER BY submittedAt ASC",
    );
    return rows.map(toRecord);
  }

  /**
   * The driver tapped Submit: save (or replace) the record and queue it for upload. Clears any
   * earlier error or block, and keeps the server version the record was based on.
   */
  async saveRecord(record: PostServiceRecord): Promise<void> {
    try {
      await this.db.runAsync(
        `INSERT INTO post_service_records
          (jobOrderId, serviceCompleted, arrivalTime, addOnKeys, paymentMethod, addOnPayment,
           completionNotes, issueReported, issueDetails, submittedAt, syncPending, syncBlocked, lastError, baseVersion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)
         ON CONFLICT(jobOrderId) DO UPDATE SET
           serviceCompleted = excluded.serviceCompleted,
           arrivalTime = excluded.arrivalTime,
           addOnKeys = excluded.addOnKeys,
           paymentMethod = excluded.paymentMethod,
           addOnPayment = excluded.addOnPayment,
           completionNotes = excluded.completionNotes,
           issueReported = excluded.issueReported,
           issueDetails = excluded.issueDetails,
           submittedAt = excluded.submittedAt,
           syncPending = 1,
           syncBlocked = 0,
           lastError = NULL,
           baseVersion = COALESCE(post_service_records.baseVersion, excluded.baseVersion)`,
        ...recordValues(record),
        record.baseVersion ?? null,
      );
    } catch (error) {
      console.error(`[SQLite] Failed to save post-service record ${record.jobOrderId}`, error);
      throw error;
    }
  }

  /**
   * The server accepted the upload. `submittedAt` identifies the copy that was sent, so a newer
   * Submit made while the upload was running stays queued.
   */
  async markSynced(jobOrderId: string, submittedAt: string, version: string | null): Promise<void> {
    await this.db.runAsync(
      `UPDATE post_service_records SET syncPending = 0, syncBlocked = 0, lastError = NULL, baseVersion = COALESCE(?, baseVersion)
       WHERE jobOrderId = ? AND submittedAt = ?`,
      version,
      jobOrderId,
      submittedAt,
    );
  }

  /** Not accepted yet but worth retrying (e.g. not distributed, server down): keep it queued with the reason. */
  async markRetrying(jobOrderId: string, submittedAt: string, message: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE post_service_records SET lastError = ? WHERE jobOrderId = ? AND submittedAt = ? AND syncPending = 1",
      message,
      jobOrderId,
      submittedAt,
    );
  }

  /** Retrying won't help (invalid details, finalized, not the driver): stop until the driver submits again. */
  async markBlocked(jobOrderId: string, submittedAt: string, message: string): Promise<void> {
    await this.db.runAsync(
      "UPDATE post_service_records SET syncBlocked = 1, lastError = ? WHERE jobOrderId = ? AND submittedAt = ? AND syncPending = 1",
      message,
      jobOrderId,
      submittedAt,
    );
  }

  /**
   * The office changed the record after this copy (409 POST_SERVICE_CHANGED): replace it with the
   * office's version, no longer queued, and keep the message for the form.
   */
  async replaceWithOffice(record: PostServiceRecord, sentSubmittedAt: string, version: string | null, message: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE post_service_records SET
         serviceCompleted = ?, arrivalTime = ?, addOnKeys = ?, paymentMethod = ?, addOnPayment = ?,
         completionNotes = ?, issueReported = ?, issueDetails = ?, submittedAt = ?,
         syncPending = 0, syncBlocked = 0, lastError = ?, baseVersion = ?
       WHERE jobOrderId = ? AND submittedAt = ?`,
      ...recordValues(record).slice(1),
      message,
      version,
      record.jobOrderId,
      sentSubmittedAt,
    );
  }
}

/** Column values in table order, from jobOrderId to submittedAt. */
function recordValues(record: PostServiceRecord): Array<string | number | null> {
  return [
    record.jobOrderId,
    record.serviceCompleted ? 1 : 0,
    record.arrivalTime,
    JSON.stringify(record.addOnKeys),
    record.paymentMethod,
    record.addOnPayment,
    record.completionNotes,
    record.issueReported ? 1 : 0,
    record.issueDetails,
    record.submittedAt,
  ];
}

function toRecord(row: PostServiceRecordRow): PostServiceRecord {
  return {
    jobOrderId: row.jobOrderId,
    serviceCompleted: row.serviceCompleted === 1,
    arrivalTime: row.arrivalTime,
    addOnKeys: parseJson<string[]>(row.addOnKeys, []),
    paymentMethod: row.paymentMethod as PaymentMethod,
    addOnPayment: row.addOnPayment as AddOnPayment | null,
    completionNotes: row.completionNotes,
    issueReported: row.issueReported === 1,
    issueDetails: row.issueDetails,
    submittedAt: row.submittedAt,
    syncPending: row.syncPending === 1,
    syncBlocked: row.syncBlocked === 1,
    lastError: row.lastError ?? null,
    baseVersion: row.baseVersion ?? null,
  };
}
