import { create } from "zustand";

import { authService, USE_SEEDER_AUTH } from "../services/AuthService";
import { SessionExpiredError, syncService } from "../services/SyncService";
import type { TeamMember } from "../types/bms";

type ProfileUpdate = Pick<TeamMember, "firstName" | "lastName" | "email" | "phone">;

type UserState = {
  /** Signed-in driver/helper, or null when signed out */
  user: TeamMember | null;
  setUser: (user: TeamMember | null) => void;
  /** Upload what can be uploaded, then sign out. Local data stays until another user signs in. */
  signOut: () => Promise<void>;
  /** The server rejected the session: go back to sign-in, keeping local data for the same user. */
  expireSession: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<void>;
  /** Reload the profile from the server (pull to refresh); the saved one stays when offline. */
  refreshProfile: () => Promise<void>;
  /** Throws an Error with a user-facing message if the current password is wrong. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
  deletionRequested: boolean;
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  deletionRequested: false,

  setUser: (user) => set({ user, deletionRequested: false }),

  signOut: async () => {
    if (!USE_SEEDER_AUTH) {
      // Best effort: send queued post-service records while the session is still valid.
      await syncService
        .sync({ isDriver: get().user?.role === "driver" })
        .catch((error) => console.warn("[Auth] Sync before sign-out failed", error));
    }
    await authService.logout();
    set({ user: null, deletionRequested: false });
  },

  expireSession: async () => {
    await authService.clearSession();
    set({ user: null, deletionRequested: false });
  },

  updateProfile: async (update) => {
    const current = get().user;
    if (!current) return;
    const firstName = update.firstName.trim();
    const lastName = update.lastName.trim();
    const next = { ...current, ...update, firstName, lastName, name: `${firstName} ${lastName}` };
    set({ user: await authService.updateOwnProfile(next) });
  },

  refreshProfile: async () => {
    const current = get().user;
    if (!current) return;
    try {
      const fresh = await authService.refreshProfile(current);
      // Ignore the answer if someone signed out meanwhile.
      if (get().user?.id === fresh.id) set({ user: fresh });
    } catch (error) {
      if (error instanceof SessionExpiredError) await get().expireSession();
      else throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const current = get().user;
    if (!current) throw new Error("Please sign in again.");
    await authService.changeOwnPassword(current.email, currentPassword, newPassword);
  },

  requestAccountDeletion: async () => {
    // TODO: notify the administrator through the BMS backend.
    set({ deletionRequested: true });
  },
}));

/** The signed-in user. Only use inside screens shown after sign-in. */
export function useCurrentUser(): TeamMember {
  const user = useUserStore((s) => s.user);
  if (!user) throw new Error("useCurrentUser used while signed out");
  return user;
}
