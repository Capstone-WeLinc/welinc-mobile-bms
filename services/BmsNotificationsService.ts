import type { AppNotification, JobOrder, NotificationTextPart, NotificationType, TeamMember } from "../types/bms";
import { formatTime12h, fromDateKey } from "../utils/dates";
import { authService } from "./AuthService";

/**
 * The signed-in driver's or helper's BMS notifications (spec bms/0023): `GET /bms/notifications`,
 * the same list the web bell reads, so read state matches. Dispatch creates them when a trip is
 * assigned, rescheduled, reassigned or cancelled. The app writes each message in its own wording,
 * from the notice kind and the job order on the phone. No notice names who made the change.
 */

const LIST_PATH = "/bms/notifications";

/** One item of `GET /bms/notifications` (only the fields the app reads). */
type BmsNotice = {
  id: string; kind: string; title: string; message: string; createdAt: string; read: boolean;
  bookingUuid?: string | null; bookingNo?: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isNotice(value: unknown): value is BmsNotice {
  const item = value as BmsNotice;
  return !!item && typeof item.id === "string" && typeof item.kind === "string" &&
    typeof item.title === "string" && typeof item.message === "string" &&
    typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt));
}

/** "Pasig to Marikina": each end is the area (landmark) when there is one, else the address. */
function route(jo: JobOrder): string {
  const ends = [jo.pickupArea || jo.pickupAddress, jo.deliveryArea || jo.deliveryAddress].map((end) => end.trim()).filter(Boolean);
  return ends.join(" to ");
}

/** "Nov 14, 7:30 AM": the service date and pickup time (dispatch time when there is none). */
function when(jo: JobOrder): string {
  const date = fromDateKey(jo.date);
  const day = Number.isNaN(date.getTime()) ? jo.date : `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  const time = [jo.pickupTime, jo.dispatchTime].find((value) => /^\d{1,2}:\d{2}$/.test(value ?? ""));
  return time ? `${day}, ${formatTime12h(time)}` : day;
}

const b = (text: string): NotificationTextPart => ({ text, bold: true });
const t = (text: string): NotificationTextPart => ({ text });

/** What the app shows for one server notice, or null for a notice the app doesn't show. */
function present(
  notice: BmsNotice, jobOrder: JobOrder | undefined,
): { type: NotificationType; message: NotificationTextPart[]; opens: boolean } | null {
  const bookingNo = jobOrder?.bookingNumber || notice.bookingNo || "";
  const booking = bookingNo ? b(`Booking #${bookingNo}`) : null;
  const asServerSends = { type: "ASSIGNMENT" as const, message: [b(notice.title), t(` ${notice.message}`)], opens: true };

  switch (notice.kind) {
    case "crew.assigned": {
      const helper = /helper/i.test(notice.title);
      const job = jobOrder ? b(`Job Order #${jobOrder.jobOrderNumber}`) : booking;
      if (!job) return asServerSends;
      const where = jobOrder && route(jobOrder) ? `, ${route(jobOrder)}.` : ".";
      return {
        type: "ASSIGNMENT",
        message: helper
          ? [t("You've been assigned as a helper on "), job, t(where)]
          : [t("You've been assigned a new job order: "), job, t(where)],
        opens: true,
      };
    }
    case "crew.rescheduled":
      if (!booking) return asServerSends;
      return {
        type: "SCHEDULE_CHANGE",
        message: jobOrder
          ? [t("Schedule change: "), booking, t(" pickup moved to "), b(`${when(jobOrder)}`), t(".")]
          : [t("Schedule change: "), booking, t(" has a new schedule.")],
        opens: true,
      };
    case "crew.unassigned":
      if (!booking) return asServerSends;
      return { type: "SCHEDULE_CHANGE", message: [t("Assignment change: "), booking, t(" was reassigned. You're no longer assigned to it.")], opens: false };
    case "crew.trip_changed":
      if (!booking) return asServerSends;
      return /cancel/i.test(notice.title)
        ? { type: "SCHEDULE_CHANGE", message: [booking, t(" was cancelled. You're no longer assigned to it.")], opens: false }
        // Sent before spec bms/0023, when a reschedule released the whole team.
        : { type: "SCHEDULE_CHANGE", message: [t("Assignment change: "), booking, t(" was rescheduled. You're no longer assigned to it.")], opens: false };
    case "crew.dispatched":
      // Distribution is a web status only (spec bms/0023); notices sent before it are hidden.
      return null;
    default:
      return asServerSends;
  }
}

/** Server notices as app notifications. `jobOrders` are the job orders on the phone, to word and open them. */
export function toBmsNotifications(user: TeamMember, items: unknown[], jobOrders: JobOrder[]): AppNotification[] {
  const byId = new Map(jobOrders.map((jo) => [jo.id, jo]));
  const list: AppNotification[] = [];
  for (const item of items) {
    if (!isNotice(item)) continue;
    const jobOrder = item.bookingUuid ? byId.get(item.bookingUuid) : undefined;
    const shown = present(item, jobOrder);
    if (!shown) continue;
    const notification: AppNotification = {
      id: `bms-${item.id}`,
      type: shown.type,
      // Nobody is named: the avatar shows the person's own initials.
      actorName: user.name,
      message: shown.message,
      createdAt: item.createdAt,
      read: item.read === true,
    };
    if (shown.opens && jobOrder) notification.jobOrderId = jobOrder.id;
    list.push(notification);
  }
  return list;
}

/** The person's BMS notifications. Throws when the server can't be reached, so saved ones stay. */
export async function fetchBmsNotifications(user: TeamMember, jobOrders: JobOrder[]): Promise<AppNotification[]> {
  const response = await authService.client.get<{ items?: unknown }>(LIST_PATH);
  if (!Array.isArray(response.data?.items)) throw new Error("The server returned an invalid notification list.");
  return toBmsNotifications(user, response.data.items, jobOrders);
}

/** The server id behind an app id (`bms-<id>`). */
export const serverId = (appId: string) => appId.slice("bms-".length);

/** Tells the server one notice was read. Resolves true when the server has it (or the notice is gone). */
export async function sendRead(appId: string): Promise<boolean> {
  try {
    await authService.client.post(`${LIST_PATH}/${encodeURIComponent(serverId(appId))}/read`);
    return true;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    return status === 404;
  }
}

/** Tells the server every notice the person can see was read. */
export async function sendReadAll(): Promise<boolean> {
  try {
    await authService.client.post(`${LIST_PATH}/read-all`);
    return true;
  } catch {
    return false;
  }
}
