import type { TeamMember, JobOrder } from "../types/bms";

/**
 * True if the user is this job order's driver or one of its helpers.
 * Server job orders list team members by their team member record id; the seeder data uses the account id.
 */
export function isAssignedTo(jobOrder: JobOrder, user: Pick<TeamMember, "id" | "teamMemberId">): boolean {
  const ids = [user.teamMemberId, user.id].filter((id): id is string => Boolean(id));
  return ids.some((id) => jobOrder.driverId === id || jobOrder.helperIds.includes(id));
}
