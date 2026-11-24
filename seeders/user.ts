import type { TeamMember } from "../types/bms";

// Seeder accounts used when EXPO_PUBLIC_USE_SEEDER_AUTH="true" (see services/AuthService.ts).

export const SEEDER_USER: TeamMember = {
  id: "team-001",
  employeeId: "DRIVER-001",
  firstName: "Juan",
  lastName: "Dela Cruz",
  name: "Juan Dela Cruz",
  role: "driver",
  email: "juandelacruz@welinc.ph",
  phone: "+639171234567",
  joinedDate: "2026-11-13",
};

export const SEEDER_HELPER: TeamMember = {
  id: "team-002",
  employeeId: "HELPER-001",
  firstName: "Bryan",
  lastName: "Galang",
  name: "Bryan Galang",
  role: "helper",
  email: "bryangalang@welinc.ph",
  phone: "+639181234567",
  joinedDate: "2026-11-13",
};

export const SEEDER_ACCOUNTS: Array<{ user: TeamMember; password: string }> = [
  { user: SEEDER_USER, password: "Welinc@123" },
  { user: SEEDER_HELPER, password: "Welinc@123" },
];
