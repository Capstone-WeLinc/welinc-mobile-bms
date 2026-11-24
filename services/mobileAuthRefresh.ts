import axios, { isAxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// Same session flow as the VRMS/VMMS app, with the BMS client and audience.
export const ACCESS_TOKEN_KEY = "bms_access_token";
export const REFRESH_TOKEN_KEY = "bms_refresh_token";
export const USER_KEY = "bms_authenticated_user";
/** The phone app's client in shared auth (welinc-auth). It admits only DRIVER and HELPER. */
export const MOBILE_CLIENT_ID = "bms-mobile";
/** Access tokens are issued for one system. */
export const TOKEN_AUDIENCE = "BMS";

/** The server no longer accepts this session; the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
  }
}

type RetriableRequest = InternalAxiosRequestConfig & { _bmsRefreshRetried?: boolean };
type TokenAnswer = { access_token?: string; refresh_token?: string };

let refreshInFlight: Promise<string> | null = null;

/**
 * Swap the refresh token for a new access + refresh token pair (`POST /auth/token`).
 * The refresh token rotates: the old one stops working once this succeeds.
 * Concurrent callers share one request.
 */
export async function refreshAccessToken(apiBaseUrl: string): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new SessionExpiredError();
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: MOBILE_CLIENT_ID,
        audience: TOKEN_AUDIENCE,
      });
      const response = await axios.post<TokenAnswer>(`${apiBaseUrl.replace(/\/$/, "")}/auth/token`, form.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15_000,
      });
      if (!response.data.access_token || !response.data.refresh_token) {
        throw new Error("The sign-in service returned an invalid refreshed session.");
      }
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.data.access_token),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.data.refresh_token),
      ]);
      return response.data.access_token;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

/** Sign-in, code and token routes never carry the access token and are never retried. */
function isPublicAuthRoute(url?: string): boolean {
  return Boolean(
    url &&
      (url.includes("/auth/mobile/login") ||
        url.includes("/auth/forgot-password") ||
        url.includes("/auth/verify-otp") ||
        url.includes("/auth/reset-password") ||
        url.includes("/auth/token") ||
        url.includes("/auth/logout")),
  );
}

/**
 * Adds the access token to every request, and on a 401 refreshes the session once and
 * retries. If the refresh is refused (401/400 from /auth/token, or no refresh token),
 * the stored session is cleared and the request fails with SessionExpiredError.
 * A network error during refresh keeps the session, so the app still works offline.
 */
export function installMobileAuth(api: AxiosInstance, apiBaseUrl: string): void {
  api.interceptors.request.use(async (config) => {
    if (!isPublicAuthRoute(config.url) && !config.headers.has("Authorization")) {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!isAxiosError(error)) return Promise.reject(error);
      const config = error.config as RetriableRequest | undefined;
      if (error.response?.status !== 401 || !config || config._bmsRefreshRetried || isPublicAuthRoute(config.url)) {
        return Promise.reject(error);
      }
      config._bmsRefreshRetried = true;
      try {
        const accessToken = await refreshAccessToken(apiBaseUrl);
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        return await api.request(config);
      } catch (refreshError) {
        const status = isAxiosError(refreshError) ? refreshError.response?.status : undefined;
        const refused = refreshError instanceof SessionExpiredError || status === 400 || status === 401 || status === 403;
        // Offline, rate limited or a server error: keep the session and let the caller retry later.
        if (!refused) return Promise.reject(refreshError);
        await clearStoredSession().catch(() => undefined);
        return Promise.reject(new SessionExpiredError());
      }
    },
  );
}
