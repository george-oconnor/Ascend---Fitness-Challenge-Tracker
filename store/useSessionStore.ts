import { createAccount, createUserProfile, deleteUserAccount, getCurrentSession, getCurrentUser, getUserProfile, signIn, signOut } from "@/lib/appwrite";
import { captureException, clearUser as clearSentryUser, logger, setUser as setSentryUser } from "@/lib/sentry";
import type { SessionState } from "@/types/type";
import { create } from "zustand";

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  status: "idle",
  error: null,
  
  checkSession: async () => {
    set({ status: "loading" });
    try {
      const session = await getCurrentSession();
      if (!session) {
        set({ user: null, token: null, status: "unauthenticated", error: null });
        return;
      }

      const user = await getCurrentUser();
      if (user) {
        setSentryUser({ id: user.$id, email: user.email, username: user.name });
        set({ user: { id: user.$id, email: user.email, name: user.name }, token: session.$id, status: "authenticated", error: null });
        return;
      }

      set({ user: null, token: null, status: "unauthenticated", error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check session";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ user: null, token: null, status: "unauthenticated", error: errorMsg });
    }
  },

  login: async (email: string, password: string) => {
    set({ status: "loading", error: null });
    try {
      await signIn(email, password);
      const user = await getCurrentUser();
      if (user) {
        // Check if user profile exists, create if missing (migration for existing users)
        const existingProfile = await getUserProfile(user.$id);
        if (!existingProfile) {
          const nameParts = (user.name || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          await createUserProfile(user.$id, user.email, firstName, lastName);
          logger.info("Created missing user profile during login", { userId: user.$id });
        }
        
        setSentryUser({ id: user.$id, email: user.email, username: user.name });
        logger.info("User logged in", { userId: user.$id });
        set({ user: { id: user.$id, email: user.email, name: user.name }, token: user.$id, status: "authenticated", error: null });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      captureException(err instanceof Error ? err : new Error(errorMsg), { email });
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  signup: async (email: string, password: string, firstName: string, lastName: string) => {
    set({ status: "loading", error: null });
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await createAccount(email, password, fullName);
      await signIn(email, password);
      
      const user = await getCurrentUser();
      if (user) {
        // Create user profile in users collection
        await createUserProfile(user.$id, email, firstName, lastName);
        
        setSentryUser({ id: user.$id, email: user.email, username: fullName });
        logger.info("User signed up", { userId: user.$id });
        set({ user: { id: user.$id, email: user.email, name: fullName }, token: user.$id, status: "authenticated", error: null });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Signup failed";
      captureException(err instanceof Error ? err : new Error(errorMsg), { email, firstName, lastName });
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  logout: async () => {
    try {
      await signOut();
      clearSentryUser();
      set({ user: null, token: null, status: "unauthenticated", error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg });
    }
  },

  deleteAccount: async () => {
    try {
      await deleteUserAccount();
      clearSentryUser();
      set({ user: null, token: null, status: "unauthenticated", error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete account";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg });
      throw err;
    }
  },

  setSession: ({ user, token }) =>
    set({ user, token, status: "authenticated", error: null }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ error: message, status: "error" }),
  clearSession: () => set({ user: null, token: null, status: "idle", error: null }),
}));
