import type { BookingStatus, JobOrder } from "../types/bms";
import { formatLongDate, toDateKey } from "./dates";

export type StatusFilter = "ALL" | BookingStatus;

export const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ONGOING", label: "Ongoing" },
  { key: "COMPLETED", label: "Done" },
];

export type DatePreset = "ALL" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "PICK";
export type DateFilter = { kind: Exclude<DatePreset, "PICK"> } | { kind: "DATE"; date: string };

export const DATE_OPTIONS: Array<{ key: DatePreset; label: string }> = [
  { key: "ALL", label: "All dates" },
  { key: "TODAY", label: "Today" },
  { key: "TOMORROW", label: "Tomorrow" },
  { key: "THIS_WEEK", label: "This week" },
  { key: "PICK", label: "Choose a date…" },
];

function addDays(base: Date, days: number): string {
  return toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

/** Inclusive [from, to] date range for a filter, or null for "All dates". */
function dateRange(filter: DateFilter): [string, string] | null {
  const now = new Date();
  switch (filter.kind) {
    case "ALL":
      return null;
    case "TODAY":
      return [toDateKey(now), toDateKey(now)];
    case "TOMORROW":
      return [addDays(now, 1), addDays(now, 1)];
    case "THIS_WEEK":
      // Sunday to Saturday, matching the Home calendar.
      return [addDays(now, -now.getDay()), addDays(now, 6 - now.getDay())];
    case "DATE":
      return [filter.date, filter.date];
  }
}

export function dateFilterLabel(filter: DateFilter): string {
  if (filter.kind === "DATE") return formatLongDate(filter.date);
  return DATE_OPTIONS.find((o) => o.key === filter.kind)!.label;
}

const STATUS_ORDER: Record<BookingStatus, number> = { ONGOING: 0, PENDING: 1, COMPLETED: 2 };

/** Ongoing first, then upcoming pending (soonest first), then done (most recent first). */
export function sortJobOrders(list: JobOrder[]): JobOrder[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const aWhen = `${a.date} ${a.pickupTime}`;
    const bWhen = `${b.date} ${b.pickupTime}`;
    return a.status === "COMPLETED" ? bWhen.localeCompare(aWhen) : aWhen.localeCompare(bWhen);
  });
}

export function filterJobOrders(list: JobOrder[], status: StatusFilter, date: DateFilter): JobOrder[] {
  // Ongoing job orders are always today's, so the date filter doesn't apply to them.
  const range = status === "ONGOING" ? null : dateRange(date);
  return sortJobOrders(
    list.filter(
      (jo) => (status === "ALL" || jo.status === status) && (!range || (jo.date >= range[0] && jo.date <= range[1])),
    ),
  );
}

/** e.g. "No pending job orders for today." */
export function emptyFilterMessage(status: StatusFilter, date: DateFilter): string {
  if (status === "ONGOING") return "No ongoing job orders today.";
  const statusWord = status === "ALL" ? "" : `${STATUS_FILTERS.find((f) => f.key === status)!.label.toLowerCase()} `;
  if (date.kind === "ALL") return status === "ALL" ? "No job orders assigned to you yet." : `No ${statusWord}job orders.`;
  const when = date.kind === "DATE" ? formatLongDate(date.date) : dateFilterLabel(date).toLowerCase();
  return `No ${statusWord}job orders for ${when}.`;
}
