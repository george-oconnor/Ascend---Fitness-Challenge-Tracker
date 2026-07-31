import {
  activateCloudKitSession,
  checkICloud,
  clearStoredIdentity,
  getStoredIdentity,
  isAppleCancel,
  isAppleCredentialValid,
  isAppleUnknownError,
  signInWithApple,
  type AppleIdentity,
} from "@/lib/auth";
import { deleteUserAccount, updateUserProfile } from "@/lib/cloudkit";
import { cloudKitHasData, resetMigrationFlag } from "@/lib/migration";
import { captureException, clearUser as clearSentryUser, logger, setUser as setSentryUser } from "@/lib/sentry";
import type { SessionState } from "@/types/type";
import { create } from "zustand";

const identityToUser = (identity: AppleIdentity, name?: string, email?: string) => ({
  id: identity.appleUserId,
  email: email ?? identity.email,
  name: name ?? identity.fullName,
});

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  status: "idle",
  error: null,
  needsMigrationCheck: false,

  checkSession: async () => {
    set({ status: "loading" });
    try {
      const identity = await getStoredIdentity();
      if (!identity) {
        set({ user: null, token: null, status: "unauthenticated", error: null });
        return;
      }
      if (!(await isAppleCredentialValid(identity.appleUserId))) {
        await clearStoredIdentity();
        set({ user: null, token: null, status: "unauthenticated", error: null });
        return;
      }
      if ((await checkICloud()) !== "available") {
        // Signed in, but the device has no usable iCloud account — data is
        // unreachable until they sign in. ICloudGate handles this state.
        set({ user: identityToUser(identity), token: null, status: "icloud-unavailable", error: null });
        return;
      }

      const { userRecordName, name, email } = await activateCloudKitSession(identity);
      const needsMigrationCheck = !(await cloudKitHasData());
      setSentryUser({ id: identity.appleUserId, email: email ?? identity.email, username: name });
      set({
        user: identityToUser(identity, name, email),
        token: userRecordName,
        status: "authenticated",
        error: null,
        needsMigrationCheck,
      });
      updateUserProfile(identity.appleUserId, { lastLoginTime: new Date().toISOString() }).catch(() => {});
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check session";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ user: null, token: null, status: "unauthenticated", error: errorMsg });
    }
  },

  loginWithApple: async () => {
    set({ status: "loading", error: null });
    try {
      logger.info("Sign in with Apple attempt");
      const identity = await signInWithApple();

      if ((await checkICloud()) !== "available") {
        set({ user: identityToUser(identity), token: null, status: "icloud-unavailable", error: null });
        return;
      }

      const { userRecordName, name, email } = await activateCloudKitSession(identity);
      const needsMigrationCheck = !(await cloudKitHasData());
      setSentryUser({ id: identity.appleUserId, email: email ?? identity.email, username: name });
      logger.info("Sign in with Apple successful", { userId: identity.appleUserId });
      set({
        user: identityToUser(identity, name, email),
        token: userRecordName,
        status: "authenticated",
        error: null,
        needsMigrationCheck,
      });
      updateUserProfile(identity.appleUserId, { lastLoginTime: new Date().toISOString() }).catch(() => {});
    } catch (err) {
      if (isAppleCancel(err)) {
        set({ status: "unauthenticated", error: null });
        return;
      }
      const errorMsg = isAppleUnknownError(err)
        ? "Sign in with Apple couldn't complete. Check that this device is signed into iCloud, then try again."
        : err instanceof Error ? err.message : "Sign in failed";
      captureException(err instanceof Error ? err : new Error(errorMsg), {
        operation: "sign_in_apple",
      });
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  recheckICloud: async () => {
    const identity = await getStoredIdentity();
    if (!identity) {
      set({ user: null, token: null, status: "unauthenticated", error: null });
      return;
    }
    if ((await checkICloud()) !== "available") {
      set({ user: identityToUser(identity), token: null, status: "icloud-unavailable", error: null });
      return;
    }
    try {
      const { userRecordName, name, email } = await activateCloudKitSession(identity);
      setSentryUser({ id: identity.appleUserId, email: email ?? identity.email, username: name });
      set({ user: identityToUser(identity, name, email), token: userRecordName, status: "authenticated", error: null });
    } catch {
      set({ user: identityToUser(identity), token: null, status: "icloud-unavailable", error: null });
    }
  },

  dismissMigrationCheck: () => set({ needsMigrationCheck: false }),

  logout: async () => {
    try {
      await clearStoredIdentity();
      clearSentryUser();
      set({ user: null, token: null, status: "unauthenticated", error: null, needsMigrationCheck: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg });
    }
  },

  deleteAccount: async () => {
    const state = useSessionStore.getState();
    const userId = state.user?.id;
    if (!userId) {
      return { success: false, error: "No user logged in" };
    }
    try {
      logger.info("Account deletion initiated", { userId });
      const result = await deleteUserAccount(userId);
      if (result.success) {
        await clearStoredIdentity();
        await resetMigrationFlag();
        clearSentryUser();
        set({ user: null, token: null, status: "unauthenticated", error: null, needsMigrationCheck: false });
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete account";
      captureException(err instanceof Error ? err : new Error(errorMsg), {
        operation: "delete_account",
      });
      return { success: false, error: errorMsg };
    }
  },

  setSession: ({ user, token }) =>
    set({ user, token, status: "authenticated", error: null }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ error: message, status: "error" }),
  clearSession: () => set({ user: null, token: null, status: "idle", error: null }),
}));
