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

  /** Records not yet received by the backend. */
  async getPendingRecords(): Promise<PostServiceRecord[]> {
    const rows = await this.db.getAllAsync<PostServiceRecordRow>(
      "SELECT * FROM post_service_records WHERE syncPending = 1 ORDER BY submittedAt ASC",
    );
    return rows.map(toRecord);
  }

  /** Save (or replace) a record and queue it for upload. */
  async saveRecord(record: PostServiceRecord): Promise<void> {
    try {
      await this.db.runAsync(
        `INSERT INTO post_service_records
          (jobOrderId, serviceCompleted, arrivalTime, addOnKeys, paymentMethod, addOnPayment,
           completionNotes, issueReported, issueDetails, submittedAt, syncPending)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
           syncPending = 1`,
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
      );
    } catch (error) {
      console.error(`[SQLite] Failed to save post-service record ${record.jobOrderId}`, error);
      throw error;
    }
  }

  async markSynced(jobOrderId: string): Promise<void> {
    await this.db.runAsync("UPDATE post_service_records SET syncPending = 0 WHERE jobOrderId = ?", jobOrderId);
  }
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
  };
}
