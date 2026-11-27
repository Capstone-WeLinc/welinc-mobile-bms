import axios, { isAxiosError, type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { SEEDER_ACCOUNTS } from "../seeders/user";
import type { TeamMember, TeamRole } from "../types/bms";
import {
  ACCESS_TOKEN_KEY,
  MOBILE_CLIENT_ID,
  REFRESH_TOKEN_KEY,
  SessionExpiredError,
  USER_KEY,
  clearStoredSession,
  installMobileAuth,
  refreshAccessToken,
} from "./mobileAuthRefresh";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

/**
 * The suite gateway (welinc-workspace, port 3000). It routes `/auth/*` to shared auth
 * (welinc-auth) and `/bms/*` to the BMS backend.
 * On a phone, use this computer's Wi-Fi IP address, e.g. http://192.168.1.20:3000.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_API_BASE_URL;

/**
 * Sign in with the seeder accounts in seeders/user.ts instead of the backend:
 * EXPO_PUBLIC_USE_SEEDER_AUTH="true" in .env. Never enable it in a release build.
 */
export const USE_SEEDER_AUTH = process.env.EXPO_PUBLIC_USE_SEEDER_AUTH?.trim().toLowerCase() === "true";

const SEEDER_TOKEN = "seeder-session";

/** The `user` in the shared auth mobile login answer. */
interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: Array<{ role: string; system: string }>;
}

/** `GET /auth/me`: the profile, with only this system's roles. */
interface AuthProfile extends AuthUser {
  contact?: string | null;
  createdAt?: string;
}

interface MobileTokenAnswer {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** The login answer for an account whose email isn't verified yet: a 6 digit code was emailed. */
export type EmailVerificationChallenge = {
  status: "EMAIL_VERIFICATION_REQUIRED";
  challengeId: string;
  email: string;
  resendAfter: string;
};

export function isEmailVerificationChallenge(value: unknown): value is EmailVerificationChallenge {
  return Boolean(value && typeof value === "object" && "challengeId" in value);
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const u = value as Record<string, unknown>;
  return typeof u.id === "string" && typeof u.name === "string" && typeof u.email === "string" && Array.isArray(u.roles);
}

/** "driver" or "helper" from the BMS role, or null for any other account. */
export function getTeamRole(roles: AuthUser["roles"] | undefined): TeamRole | null {
  const bms = (roles ?? []).filter((r) => String(r.system).toUpperCase() === "BMS").map((r) => r.role);
  if (bms.includes("DRIVER")) return "driver";
  if (bms.includes("HELPER")) return "helper";
  return null;
}

function toTeamMember(user: AuthProfile, role: TeamRole, previous?: TeamMember): TeamMember {
  const parts = user.name.trim().split(/\s+/);
  return {
    ...previous,
    id: user.id,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    name: user.name.trim(),
    role,
    email: user.email,
    phone: user.contact ?? previous?.phone ?? "",
    joinedDate: user.createdAt ? user.createdAt.slice(0, 10) : previous?.joinedDate,
  };
}

/** The server's message for a failed request, or a friendly fallback. */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof SessionExpiredError) return error.message;
  if (isAxiosError(error)) {
    if (!error.response) {
      return error.code === "ECONNABORTED"
        ? "The server took too long to answer. Try again."
        : `Unable to reach the server at ${API_BASE_URL}. Check your connection and try again.`;
    }
    const data = error.response.data as { message?: unknown; error_description?: unknown } | undefined;
    const message = data?.message ?? data?.error_description;
    if (typeof message === "string" && message) return message;
    if (Array.isArray(message)) {
      const parts = message.filter((item): item is string => typeof item === "string");
      if (parts.length) return parts.join("\n");
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 401) return "Incorrect email or password.";
  return getApiErrorMessage(error, "Unable to sign in.");
}

const NOT_TEAM_MESSAGE = "This app is for Driver and Helper accounts.";

// Seeder-only password store, so changing the password on Profile affects the next seeder sign-in.
const seederPasswords = new Map(SEEDER_ACCOUNTS.map((a) => [a.user.email.toLowerCase(), a.password]));

export class AuthService {
  private readonly api: AxiosInstance;

  constructor(apiBaseUrl: string = API_BASE_URL) {
    this.api = axios.create({
      baseURL: apiBaseUrl,
      timeout: 15_000,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
    installMobileAuth(this.api, apiBaseUrl);
  }

  /** The configured client for calls to the BMS backend (adds and refreshes the access token). */
  get client(): AxiosInstance {
    return this.api;
  }

  /**
   * Sign in. Returns the signed-in team member, or the email code step when the account's
   * email isn't verified yet (finish it with `verifyEmail`).
   */
  async login(email: string, password: string): Promise<TeamMember | EmailVerificationChallenge> {
    const normalizedEmail = email.trim().toLowerCase();

    if (USE_SEEDER_AUTH) {
      const account = SEEDER_ACCOUNTS.find((a) => a.user.email.toLowerCase() === normalizedEmail);
      if (!account || seederPasswords.get(normalizedEmail) !== password) throw new Error("Incorrect email or password.");
      await this.saveSeederSession(account.user);
      return account.user;
    }

    try {
      const response = await this.api.post<MobileTokenAnswer | EmailVerificationChallenge>("/auth/mobile/login", {
        email: normalizedEmail,
        password,
        clientId: MOBILE_CLIENT_ID,
        deviceName: deviceName(),
      });
      if (isEmailVerificationChallenge(response.data)) return response.data;
      return await this.startSession(response.data);
    } catch (error) {
      throw new Error(getLoginErrorMessage(error));
    }
  }

  /** Finish the email code step of a sign-in. */
  async verifyEmail(challengeId: string, code: string): Promise<TeamMember> {
    try {
      const response = await this.api.post<MobileTokenAnswer>("/auth/mobile/login/verify-email", {
        challengeId,
        code: code.trim(),
        clientId: MOBILE_CLIENT_ID,
        deviceName: deviceName(),
      });
      return await this.startSession(response.data);
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to verify the code."));
    }
  }

  async resendEmailCode(challengeId: string): Promise<void> {
    try {
      await this.api.post("/auth/mobile/login/verify-email/resend", { challengeId });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to send a new code."));
    }
  }

  /** Forgot password, step 1: email a 6 digit reset code (the server answers the same for unknown emails). */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to send the reset code."));
    }
  }

  /** Forgot password, step 2: check the code before asking for the new password. */
  async verifyPasswordResetCode(email: string, otp: string): Promise<void> {
    try {
      await this.api.post("/auth/verify-otp", { email: email.trim().toLowerCase(), otp: otp.trim() });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to check the reset code."));
    }
  }

  /** Forgot password, step 3: set the new password with the same code. */
  async resetPassword(input: { email: string; otp: string; newPassword: string }): Promise<void> {
    try {
      await this.api.post("/auth/reset-password", {
        email: input.email.trim().toLowerCase(),
        otp: input.otp.trim(),
        newPassword: input.newPassword,
      });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to change the password."));
    }
  }

  /**
   * The signed-in user from the last session, or null if signed out. The session is
   * refreshed; if the server is unreachable the stored user is kept so the app opens offline.
   */
  async restoreSession(): Promise<TeamMember | null> {
    const [token, userJson] = await Promise.all([this.getAccessToken(), SecureStore.getItemAsync(USER_KEY)]);
    if (!token || !userJson) return null;

    let storedUser: TeamMember;
    try {
      storedUser = JSON.parse(userJson) as TeamMember;
    } catch {
      await this.clearSession();
      return null;
    }
    if (USE_SEEDER_AUTH) return token === SEEDER_TOKEN ? storedUser : null;
    if (token === SEEDER_TOKEN) {
      await this.clearSession();
      return null;
    }

    try {
      await refreshAccessToken(API_BASE_URL);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (error instanceof SessionExpiredError || status === 400 || status === 401 || status === 403) {
        // The refresh token was refused (ended, expired or the account was disabled).
        await this.clearSession();
        return null;
      }
      // Server unreachable or busy: keep the stored user so the app still opens offline.
      return storedUser;
    }
    return (await this.loadProfile(storedUser)) ?? storedUser;
  }

  /**
   * Reload the signed-in person's profile from the server (pull to refresh). Keeps `current` when
   * the server can't be reached; throws SessionExpiredError when the session has ended.
   */
  async refreshProfile(current: TeamMember): Promise<TeamMember> {
    if (USE_SEEDER_AUTH) return current;
    return (await this.loadProfile(current)) ?? current;
  }

  getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  /** End the session on the server (best effort), then forget it on this phone. */
  async logout(): Promise<void> {
    if (!USE_SEEDER_AUTH) {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          await this.api.post("/auth/logout", { refreshToken, clientId: MOBILE_CLIENT_ID });
        } catch (error) {
          console.warn("[Auth] Unable to end the session on the server", error);
        }
      }
    }
    await this.clearSession();
  }

  /** Name and mobile number. Email changes need a verification code and aren't in the app yet. */
  async updateOwnProfile(user: TeamMember): Promise<TeamMember> {
    if (USE_SEEDER_AUTH) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return user;
    }
    try {
      const response = await this.api.patch<unknown>("/auth/profile", { name: user.name, contact: user.phone || "" });
      const profile = response.data as Partial<AuthProfile> | undefined;
      const saved: TeamMember = {
        ...user,
        name: typeof profile?.name === "string" ? profile.name : user.name,
        phone: typeof profile?.contact === "string" ? profile.contact : user.phone,
      };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(saved));
      return saved;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to save personal details."));
    }
  }

  async changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    if (USE_SEEDER_AUTH) {
      const key = email.toLowerCase();
      if (seederPasswords.get(key) !== currentPassword) throw new Error("Current password is incorrect.");
      seederPasswords.set(key, newPassword);
      return;
    }
    try {
      await this.api.patch("/auth/profile/password", { currentPassword, newPassword, confirmPassword: newPassword });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to change the password."));
    }
  }

  async clearSession(): Promise<void> {
    await clearStoredSession();
  }

  /** Store the tokens, then the user (with the profile details from /auth/me when reachable). */
  private async startSession(answer: MobileTokenAnswer): Promise<TeamMember> {
    if (!answer?.accessToken || !answer.refreshToken || !isAuthUser(answer.user)) {
      throw new Error("The server returned an invalid sign-in response.");
    }
    const role = getTeamRole(answer.user.roles);
    if (!role) {
      // Shared auth already refuses other roles for this app; this is a second check.
      throw new Error(NOT_TEAM_MESSAGE);
    }
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, answer.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, answer.refreshToken),
    ]);
    const basic = toTeamMember(answer.user, role);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(basic));
    return (await this.loadProfile(basic)) ?? basic;
  }

  /** Refresh the stored user from `GET /auth/me` (mobile number, join date). Null if unavailable. */
  private async loadProfile(current: TeamMember): Promise<TeamMember | null> {
    try {
      const response = await this.api.get<unknown>("/auth/me");
      if (!isAuthUser(response.data)) return null;
      const role = getTeamRole(response.data.roles) ?? current.role;
      const user = toTeamMember(response.data as AuthProfile, role, current);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      return null;
    }
  }

  private async saveSeederSession(user: TeamMember): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, SEEDER_TOKEN),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
  }
}

/** Shown in the person's session list on the web. */
function deviceName(): string {
  return `BMS app on ${Platform.OS}`;
}

export const authService = new AuthService();
