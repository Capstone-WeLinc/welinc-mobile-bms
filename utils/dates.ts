// Date and time helpers shared by the calendar, booking and leave screens.

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Thu, Nov 19, 2026" */
export function formatLongDate(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Nov. 12, 2026" (May has no period since it isn't abbreviated) */
export function formatShortDate(key: string): string {
  const date = fromDateKey(key);
  const month = MONTH_ABBR[date.getMonth()];
  return `${month}${month === "May" ? "" : "."} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "14:00" -> "2:00 PM" */
export function formatTime12h(time: string): string {
  // Bookings may have no readable time yet; show a dash instead of "NaN:NaN".
  if (!/^\d{1,2}:\d{2}$/.test(time ?? "")) return "—";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Number of calendar days from start to end, counting both ends. 0 if end is before start. */
export function inclusiveDayCount(startKey: string, endKey: string): number {
  const ms = fromDateKey(endKey).getTime() - fromDateKey(startKey).getTime();
  const days = Math.round(ms / 86_400_000) + 1;
  return days > 0 ? days : 0;
}

/** Calendar cells for a month view, Sunday-first, padded with adjacent-month days. */
export function buildMonthGrid(year: number, month: number): Array<{ key: string; day: number; inMonth: boolean }> {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { key: toDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

/** "Sat, Nov 21" */
export function formatDayMonth(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

/** "Just now", "2 minutes ago", "3 hours ago", or "Nov 11 at 5:48 PM" for anything older than a day. */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const time = formatTime12h(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()} at ${time}`;
}
