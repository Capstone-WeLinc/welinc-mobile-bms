import type { SQLiteDatabase } from "expo-sqlite";

import type { JobOrderRow } from "../database/tables";
import type { BookingStatus, ChargeLine, JobOrder } from "../types/bms";
import { parseJson } from "./json";

export class JobOrderRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getJobOrders(): Promise<JobOrder[]> {
    const rows = await this.db.getAllAsync<JobOrderRow>("SELECT * FROM job_orders ORDER BY date ASC, pickupTime ASC");
    return rows.map(toJobOrder);
  }

  async getJobOrderById(id: string): Promise<JobOrder | null> {
    const row = await this.db.getFirstAsync<JobOrderRow>("SELECT * FROM job_orders WHERE id = ?", id);
    return row ? toJobOrder(row) : null;
  }

  /**
   * Replace the cache with a complete snapshot of assigned job orders:
   * upsert every incoming row and delete rows the snapshot no longer contains.
   * Run inside a transaction so a failure never leaves a half-updated cache.
   */
  async reconcileSnapshot(jobOrders: JobOrder[], syncedAt = new Date().toISOString()): Promise<void> {
    try {
      await this.db.execAsync("CREATE TEMP TABLE IF NOT EXISTS incoming_job_order_ids (id TEXT PRIMARY KEY)");
      await this.db.execAsync("DELETE FROM incoming_job_order_ids");

      for (const jobOrder of jobOrders) {
        await this.upsert(jobOrder, syncedAt);
        await this.db.runAsync("INSERT OR IGNORE INTO incoming_job_order_ids (id) VALUES (?)", jobOrder.id);
      }

      await this.db.runAsync("DELETE FROM job_orders WHERE id NOT IN (SELECT id FROM incoming_job_order_ids)");
    } catch (error) {
      console.error("[SQLite] Job order reconciliation failed", error);
      throw error;
    }
  }

  private async upsert(jo: JobOrder, updatedAt: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO job_orders
        (id, jobOrderNumber, bookingNumber, status, postServiceFormSubmitted, clientName, contactNumber,
         date, pickupTime, dispatchTime, driverId, driverName, helperIds, helperNames, garage, vehicle,
         pickupArea, pickupAddress, deliveryArea, deliveryAddress, estimatedItems, itemDescription,
         customerInstruction, insured, paymentMethod, charges, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         jobOrderNumber = excluded.jobOrderNumber,
         bookingNumber = excluded.bookingNumber,
         status = excluded.status,
         postServiceFormSubmitted = excluded.postServiceFormSubmitted,
         clientName = excluded.clientName,
         contactNumber = excluded.contactNumber,
         date = excluded.date,
         pickupTime = excluded.pickupTime,
         dispatchTime = excluded.dispatchTime,
         driverId = excluded.driverId,
         driverName = excluded.driverName,
         helperIds = excluded.helperIds,
         helperNames = excluded.helperNames,
         garage = excluded.garage,
         vehicle = excluded.vehicle,
         pickupArea = excluded.pickupArea,
         pickupAddress = excluded.pickupAddress,
         deliveryArea = excluded.deliveryArea,
         deliveryAddress = excluded.deliveryAddress,
         estimatedItems = excluded.estimatedItems,
         itemDescription = excluded.itemDescription,
         customerInstruction = excluded.customerInstruction,
         insured = excluded.insured,
         paymentMethod = excluded.paymentMethod,
         charges = excluded.charges,
         updatedAt = excluded.updatedAt`,
      jo.id,
      jo.jobOrderNumber,
      jo.bookingNumber,
      jo.status,
      jo.postServiceFormSubmitted ? 1 : 0,
      jo.clientName,
      jo.contactNumber,
      jo.date,
      jo.pickupTime,
      jo.dispatchTime,
      jo.driverId,
      jo.driverName,
      JSON.stringify(jo.helperIds),
      JSON.stringify(jo.helperNames),
      jo.garage,
      jo.vehicle,
      jo.pickupArea,
      jo.pickupAddress,
      jo.deliveryArea,
      jo.deliveryAddress,
      jo.estimatedItems,
      jo.itemDescription,
      jo.customerInstruction,
      jo.insured ? 1 : 0,
      jo.paymentMethod,
      JSON.stringify(jo.charges),
      updatedAt,
    );
  }
}

function toJobOrder(row: JobOrderRow): JobOrder {
  return {
    id: row.id,
    jobOrderNumber: row.jobOrderNumber,
    bookingNumber: row.bookingNumber,
    status: row.status as BookingStatus,
    postServiceFormSubmitted: row.postServiceFormSubmitted === 1,
    clientName: row.clientName,
    contactNumber: row.contactNumber,
    date: row.date,
    pickupTime: row.pickupTime,
    dispatchTime: row.dispatchTime,
    driverId: row.driverId,
    driverName: row.driverName,
    helperIds: parseJson<string[]>(row.helperIds, []),
    helperNames: parseJson<string[]>(row.helperNames, []),
    garage: row.garage,
    vehicle: row.vehicle,
    pickupArea: row.pickupArea,
    pickupAddress: row.pickupAddress,
    deliveryArea: row.deliveryArea,
    deliveryAddress: row.deliveryAddress,
    estimatedItems: row.estimatedItems,
    itemDescription: row.itemDescription,
    customerInstruction: row.customerInstruction,
    insured: row.insured === 1,
    paymentMethod: row.paymentMethod,
    charges: parseJson<ChargeLine[]>(row.charges, []),
  };
}
