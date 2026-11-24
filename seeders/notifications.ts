import type { AppNotification, TeamMember, JobOrder } from "../types/bms";
import { isAssignedTo } from "../utils/assignments";
import { formatDayMonth, formatTime12h } from "../utils/dates";

// TODO: replace with the signed-in user's notifications from the BMS backend (and push notifications).

const ADMIN = "Admin Dela Rosa";

/** Job orders this user is assigned to, as the driver or as one of the helpers. */
function assignedTo(user: TeamMember, jobOrders: JobOrder[]): JobOrder[] {
  return jobOrders.filter((jo) => isAssignedTo(jo, user));
}

const byWhen = (a: JobOrder, b: JobOrder) => `${a.date} ${a.pickupTime}`.localeCompare(`${b.date} ${b.pickupTime}`);

/** Seeder notifications for one user, built from the job orders they're assigned to. */
export function getSeederNotifications(user: TeamMember, jobOrders: JobOrder[], now = new Date()): AppNotification[] {
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const id = (suffix: string) => `n-${user.id}-${suffix}`;
  const mine = assignedTo(user, jobOrders).sort(byWhen);
  const pending = mine.filter((jo) => jo.status === "PENDING");
  const done = mine.filter((jo) => jo.status === "COMPLETED");

  const newAssignment = pending[pending.length - 1]; // furthest upcoming job
  const rescheduled = pending[0]; // soonest upcoming job
  const ongoing = mine.find((jo) => jo.status === "ONGOING");
  const completed = done[done.length - 1]; // most recently done
  const olderAssignment = done[0]; // earliest done

  const assignedAs = user.role === "driver" ? " assigned you a new job order: " : " assigned you as a helper on ";
  const assignment = (jo: JobOrder) => [
    { text: ADMIN, bold: true },
    { text: assignedAs },
    { text: `Job Order #${jo.jobOrderNumber}`, bold: true },
    { text: `, ${jo.pickupArea} to ${jo.deliveryArea}.` },
  ];

  const list: Array<AppNotification | false | undefined> = [
    newAssignment && {
      id: id("assigned-new"),
      type: "ASSIGNMENT",
      actorName: ADMIN,
      message: assignment(newAssignment),
      createdAt: ago(2),
      read: false,
      jobOrderId: newAssignment.id,
    },
    rescheduled && rescheduled !== newAssignment && {
      id: id("rescheduled"),
      type: "SCHEDULE_CHANGE",
      actorName: user.name,
      message: [
        { text: "Schedule change: " },
        { text: `Booking #${rescheduled.jobOrderNumber}`, bold: true },
        { text: " pickup moved to " },
        { text: `${formatDayMonth(rescheduled.date)}, ${formatTime12h(rescheduled.pickupTime)}.`, bold: true },
      ],
      createdAt: ago(60),
      read: false,
      jobOrderId: rescheduled.id,
    },
    // Post-service records are filled out by drivers only.
    user.role === "driver" &&
      ongoing && {
        id: id("post-service-reminder"),
        type: "REMINDER",
        driversOnly: true,
        actorName: user.name,
        message: [
          { text: "Reminder:", bold: true },
          { text: " post your service completion for " },
          { text: `Booking #${ongoing.jobOrderNumber}`, bold: true },
          { text: "." },
        ],
        createdAt: ago(180),
        read: false,
        jobOrderId: ongoing.id,
      },
    completed && {
      id: id("completed"),
      type: "COMPLETED",
      actorName: user.name,
      message: [
        { text: `Booking #${completed.jobOrderNumber}`, bold: true },
        { text: " was marked completed. Thank you for your service!" },
      ],
      createdAt: ago(60 * 24 * 2 + 30),
      read: true,
      jobOrderId: completed.id,
    },
    olderAssignment && olderAssignment !== completed && {
      id: id("assigned-old"),
      type: "ASSIGNMENT",
      actorName: ADMIN,
      message: assignment(olderAssignment),
      createdAt: ago(60 * 24 * 8),
      read: true,
      jobOrderId: olderAssignment.id,
    },
    {
      id: id("password-changed"),
      type: "ACCOUNT",
      actorName: user.name,
      message: [{ text: "Your password was changed successfully." }],
      createdAt: ago(60 * 24 * 11 + 120),
      read: true,
    },
  ];

  return list.filter((n): n is AppNotification => Boolean(n));
}
