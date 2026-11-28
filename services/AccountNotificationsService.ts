import type { AppNotification, ProfileField, TeamMember } from "../types/bms";
import { authService } from "./AuthService";

/**
 * Account notifications for a real (server) sign-in, built from the person's own activity in
 * shared auth: `GET /auth/profile/activity?category=ACCOUNT` (welinc-auth spec 0011). Any user
 * token may read its own events, the bms-mobile one included. `createdAt` is the server's time,
 * so the app shows the same date and time as the portal.
 *
 * Job order notifications come from BmsNotificationsService and utils/jobOrderNotices (spec bms/0023).
 */

type ActorKind = "SELF" | "ADMIN" | "SYSTEM";

/** One item of `GET /auth/profile/activity` (only the fields the app reads). */
interface AccountEvent {
  id: string;
  type: string;
  createdAt: string;
  /** For UPDATED: which detail changed (`name`, `email`, `contact`). */
  field?: string | null;
  /**
   * Shared auth gives the person only the actor's kind (spec 0011, AC-11). `name` is read in
   * case that ever changes; until then an admin shows as "Administrator".
   */
  actor?: { kind?: ActorKind; name?: string };
}

/** What a changed detail is called in a notification, and the Profile field it opens. */
const UPDATED_FIELDS: Record<string, { label: string; profileField: ProfileField }> = {
  name: { label: "name", profileField: "name" },
  email: { label: "email address", profileField: "email" },
  contact: { label: "mobile number", profileField: "contact" },
};

/** Account events a team member should hear about, with what to say when they did it / an admin did. */
const MESSAGES: Record<string, { self: string; admin: string }> = {
  CREATED: { self: "Your account was created.", admin: "An administrator created your account." },
  PASSWORD_CHANGED: {
    self: "Your password was changed successfully.",
    admin: "An administrator changed your password.",
  },
  UPDATED: { self: "Your account details were updated.", admin: "An administrator changed your details." },
  ROLE_CHANGED: { self: "Your role was changed.", admin: "An administrator changed your role." },
  UNLOCKED: { self: "Your account was unlocked.", admin: "An administrator unlocked your account." },
  ACTIVATED: { self: "Your account was activated.", admin: "An administrator activated your account." },
  SESSIONS_ENDED: {
    self: "You signed out on every device.",
    admin: "An administrator signed you out on every device.",
  },
  PICTURE_CHANGED: { self: "Your profile picture was changed.", admin: "Your profile picture was changed." },
};

const ADMIN_NAME = "Administrator";
const PAGE_SIZE = 50;

function isAccountEvent(value: unknown): value is AccountEvent {
  const v = value as Partial<AccountEvent> | null;
  return Boolean(v) && typeof v?.id === "string" && typeof v?.type === "string" && typeof v?.createdAt === "string";
}

/** Turns account events into notifications; unknown or uninteresting event types are skipped. */
export function toAccountNotifications(user: TeamMember, events: unknown[]): AppNotification[] {
  const list: AppNotification[] = [];
  for (const event of events) {
    if (!isAccountEvent(event)) continue;
    if (Number.isNaN(Date.parse(event.createdAt))) continue;
    const byAdmin = event.actor?.kind === "ADMIN";
    const updated = event.type === "UPDATED" && event.field ? UPDATED_FIELDS[event.field] : undefined;
    let message: string;
    let profileField: ProfileField | undefined;
    if (updated) {
      message = byAdmin ? `An administrator changed your ${updated.label}.` : `Your ${updated.label} was updated.`;
      profileField = updated.profileField;
    } else {
      const text = MESSAGES[event.type];
      if (!text) continue;
      message = byAdmin ? text.admin : text.self;
      if (event.type === "PASSWORD_CHANGED") profileField = "password";
    }
    const adminName = event.actor?.name?.trim() || ADMIN_NAME;
    const notification: AppNotification = {
      id: `account-${event.id}`,
      type: "ACCOUNT",
      actorName: byAdmin ? adminName : user.name,
      message: [{ text: message }],
      createdAt: event.createdAt,
      read: false,
    };
    if (profileField) notification.profileField = profileField;
    list.push(notification);
  }
  return list;
}

/**
 * The signed-in person's account notifications, newest first. Throws when the server can't be
 * reached, so the caller keeps what is already saved on the phone.
 */
export async function fetchAccountNotifications(user: TeamMember): Promise<AppNotification[]> {
  const response = await authService.client.get<{ data?: unknown }>("/auth/profile/activity", {
    params: { category: "ACCOUNT", limit: PAGE_SIZE },
  });
  const events = Array.isArray(response.data?.data) ? response.data.data : [];
  return toAccountNotifications(user, events);
}
