import type { AppNotification, JobOrder, TeamMember } from "../types/bms";

/**
 * Notices the phone builds from its own job orders (spec bms/0023): the server never sends them.
 * - Reminder: a driver's ongoing job order with no post-service form sent yet.
 * - Completed: a job order that is done.
 * Ids are stable per job order, and the repository keeps the time each one first appeared.
 * A notice disappears once its condition ends (the form was sent, or the job order left the phone).
 */
export function buildJobOrderNotices(user: TeamMember, jobOrders: JobOrder[], now = new Date()): AppNotification[] {
  const createdAt = now.toISOString();
  const list: AppNotification[] = [];
  for (const jo of jobOrders) {
    const booking = { text: `Booking #${jo.bookingNumber}`, bold: true };
    if (user.role === "driver" && jo.status === "ONGOING" && !jo.postServiceFormSubmitted && !jo.postServiceLocked) {
      list.push({
        id: `local-reminder-${jo.id}`,
        type: "REMINDER",
        driversOnly: true,
        actorName: user.name,
        message: [{ text: "Reminder:", bold: true }, { text: " post your service completion for " }, booking, { text: "." }],
        createdAt,
        read: false,
        jobOrderId: jo.id,
      });
    }
    if (jo.status === "COMPLETED") {
      list.push({
        id: `local-completed-${jo.id}`,
        type: "COMPLETED",
        actorName: user.name,
        message: [booking, { text: " was marked completed. Thank you for your service!" }],
        createdAt,
        read: false,
        jobOrderId: jo.id,
      });
    }
  }
  return list;
}
