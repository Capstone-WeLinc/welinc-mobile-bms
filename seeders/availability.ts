import type { TeamMember, LeaveType, Weekday, WeeklyAvailability } from "../types/bms";

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

const SEEDER_WEEKLY_AVAILABILITY: WeeklyAvailability = {
  MONDAY: true,
  TUESDAY: true,
  WEDNESDAY: true,
  THURSDAY: true,
  FRIDAY: true,
  SATURDAY: false,
  SUNDAY: false,
};

/** Starting weekly availability for a user: drivers Mon–Fri, helpers Mon–Sat. */
export function getSeederAvailability(user: Pick<TeamMember, "role">): WeeklyAvailability {
  return user.role === "helper" ? { ...SEEDER_WEEKLY_AVAILABILITY, SATURDAY: true } : { ...SEEDER_WEEKLY_AVAILABILITY };
}
