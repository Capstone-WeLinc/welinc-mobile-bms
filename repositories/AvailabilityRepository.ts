import type { SQLiteDatabase } from "expo-sqlite";

import type { LeaveRequestRow, WeeklyAvailabilityRow } from "../database/tables";
import type { LeaveRequest, LeaveType, WeeklyAvailability } from "../types/bms";

export class AvailabilityRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  /** The user's saved weekly availability, or null if they have never saved one. */
  async getWeekly(userId: string): Promise<WeeklyAvailability | null> {
    const row = await this.db.getFirstAsync<WeeklyAvailabilityRow>(
      "SELECT * FROM weekly_availability WHERE userId = ?",
      userId,
    );
    if (!row) return null;
    return {
      MONDAY: row.monday === 1,
      TUESDAY: row.tuesday === 1,
      WEDNESDAY: row.wednesday === 1,
      THURSDAY: row.thursday === 1,
      FRIDAY: row.friday === 1,
      SATURDAY: row.saturday === 1,
      SUNDAY: row.sunday === 1,
    };
  }

  async saveWeekly(userId: string, a: WeeklyAvailability, updatedAt = new Date().toISOString()): Promise<void> {
    try {
      await this.db.runAsync(
        `INSERT INTO weekly_availability
          (userId, monday, tuesday, wednesday, thursday, friday, saturday, sunday, updatedAt, syncPending)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(userId) DO UPDATE SET
           monday = excluded.monday,
           tuesday = excluded.tuesday,
           wednesday = excluded.wednesday,
           thursday = excluded.thursday,
           friday = excluded.friday,
           saturday = excluded.saturday,
           sunday = excluded.sunday,
           updatedAt = excluded.updatedAt,
           syncPending = 1`,
        userId,
        a.MONDAY ? 1 : 0,
        a.TUESDAY ? 1 : 0,
        a.WEDNESDAY ? 1 : 0,
        a.THURSDAY ? 1 : 0,
        a.FRIDAY ? 1 : 0,
        a.SATURDAY ? 1 : 0,
        a.SUNDAY ? 1 : 0,
        updatedAt,
      );
    } catch (error) {
      console.error(`[SQLite] Failed to save weekly availability for ${userId}`, error);
      throw error;
    }
  }

  /** The user's leave requests, oldest first. */
  async getLeaveRequests(userId: string): Promise<LeaveRequest[]> {
    const rows = await this.db.getAllAsync<LeaveRequestRow>(
      "SELECT * FROM leave_requests WHERE userId = ? ORDER BY submittedAt ASC",
      userId,
    );
    return rows.map((row) => ({
      submittedAt: row.submittedAt,
      leaveType: row.leaveType as LeaveType,
      startDate: row.startDate,
      endDate: row.endDate,
      reason: row.reason,
    }));
  }

  /** Store a leave request and queue it for upload. Returns the local id. */
  async insertLeaveRequest(userId: string, request: LeaveRequest): Promise<string> {
    const submittedAt = request.submittedAt ?? new Date().toISOString();
    const id = `leave-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await this.db.runAsync(
        `INSERT INTO leave_requests (id, userId, leaveType, startDate, endDate, reason, submittedAt, syncPending)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        userId,
        request.leaveType,
        request.startDate,
        request.endDate,
        request.reason,
        submittedAt,
      );
      return id;
    } catch (error) {
      console.error(`[SQLite] Failed to save leave request for ${userId}`, error);
      throw error;
    }
  }
}
