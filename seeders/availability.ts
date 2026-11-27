import type { LeaveType, Weekday, WeeklyAvailability } from "../types/bms";

// TODO: load and save these through the BMS backend once the availability/leave endpoints exist.

export const WEEKDAYS: Array<{ key: Weekday; label: string }> = [
  { key: "MONDAY", label: "Monday" },
  { key: "TUESDAY", label: "Tuesday" },
  { key: "WEDNESDAY", label: "Wednesday" },
  { key: "THURSDAY", label: "Thursday" },
  { key: "FRIDAY", label: "Friday" },
  { key: "SATURDAY", label: "Saturday" },
  { key: "SUNDAY", label: "Sunday" },
];

export const LEAVE_TYPES: Array<{ key: LeaveType; label: string }> = [
  { key: "SICK", label: "Sick Leave" },
  { key: "VACATION", label: "Vacation Leave" },
  { key: "EMERGENCY", label: "Emergency Leave" },
  { key: "PERSONAL", label: "Personal Leave" },
  { key: "OTHER", label: "Other" },
];

/** No days picked. Every team member starts here and chooses their own days (nothing is set for them). */
export const NO_DAYS_SELECTED: WeeklyAvailability = {
  MONDAY: false,
  TUESDAY: false,
  WEDNESDAY: false,
  THURSDAY: false,
  FRIDAY: false,
  SATURDAY: false,
  SUNDAY: false,
};
