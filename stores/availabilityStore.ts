import { create } from "zustand";

import { getDatabase } from "../database/database";
import { getSeederAvailability } from "../seeders/availability";
import { AvailabilityRepository } from "../repositories/AvailabilityRepository";
import type { TeamMember, LeaveRequest, WeeklyAvailability } from "../types/bms";

type AvailabilityState = {
  /** Saved weekly availability, per user id */
  weeklyByUser: Record<string, WeeklyAvailability>;
  /** Submitted leave requests, per user id */
  leaveRequestsByUser: Record<string, LeaveRequest[]>;
  /** Load this user's saved availability and leave requests from SQLite (call on sign-in). */
  loadForUser: (userId: string) => Promise<void>;
  saveWeekly: (userId: string, availability: WeeklyAvailability) => Promise<void>;
  submitLeave: (userId: string, request: LeaveRequest) => Promise<void>;
};

export const useAvailabilityStore = create<AvailabilityState>((set, get) => ({
  weeklyByUser: {},
  leaveRequestsByUser: {},

  loadForUser: async (userId) => {
    const repository = new AvailabilityRepository(await getDatabase());
    const [weekly, leaveRequests] = await Promise.all([
      repository.getWeekly(userId),
      repository.getLeaveRequests(userId),
    ]);
    const { weeklyByUser, leaveRequestsByUser } = get();
    const nextWeekly = { ...weeklyByUser };
    if (weekly) nextWeekly[userId] = weekly;
    else delete nextWeekly[userId];
    set({ weeklyByUser: nextWeekly, leaveRequestsByUser: { ...leaveRequestsByUser, [userId]: leaveRequests } });
  },

  saveWeekly: async (userId, availability) => {
    // Saved locally with syncPending = 1. TODO: send to the BMS backend.
    await new AvailabilityRepository(await getDatabase()).saveWeekly(userId, availability);
    set({ weeklyByUser: { ...get().weeklyByUser, [userId]: availability } });
  },

  submitLeave: async (userId, request) => {
    // Saved locally with syncPending = 1.
    // TODO: POST to the BMS backend, which notifies the administrator.
    const stored = { ...request, submittedAt: request.submittedAt ?? new Date().toISOString() };
    await new AvailabilityRepository(await getDatabase()).insertLeaveRequest(userId, stored);
    const list = get().leaveRequestsByUser[userId] ?? [];
    set({ leaveRequestsByUser: { ...get().leaveRequestsByUser, [userId]: [...list, stored] } });
  },
}));

/** The signed-in user's saved weekly availability (seeder data until they save their own). */
export function useMyWeeklyAvailability(user: TeamMember): WeeklyAvailability {
  const saved = useAvailabilityStore((s) => s.weeklyByUser[user.id]);
  return saved ?? getSeederAvailability(user);
}
