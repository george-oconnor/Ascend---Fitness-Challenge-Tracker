import { captureException, logger } from "@/lib/sentry";
import {
  connectStrava,
  disconnectStrava,
  isStravaConnected,
  StravaAuthCancelledError,
} from "@/lib/strava";
import { useChallengeStore } from "@/store/useChallengeStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type StravaState = {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  isCheckingConnection: boolean;
  error: string | null;
  // Whether Strava-sourced workouts should also be written to Apple Health
  // (in addition to being stored in Ascend). Off by default — most users
  // already have Strava's own native HealthKit sync running, and turning
  // this on is for people who've disabled that in favor of Ascend's more
  // accurate type mapping.
  syncToAppleHealth: boolean;

  checkConnection: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<void>;
  setSyncToAppleHealth: (value: boolean) => void;
};

export const useStravaStore = create<StravaState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isConnecting: false,
      isSyncing: false,
      isCheckingConnection: false,
      error: null,
      syncToAppleHealth: false,

      checkConnection: async () => {
        set({ isCheckingConnection: true });
        try {
          const connected = await isStravaConnected();
          set({ isConnected: connected, isCheckingConnection: false });
        } catch (err) {
          set({ isCheckingConnection: false });
          captureException(err instanceof Error ? err : new Error("Strava connection check failed"));
        }
      },

      connect: async () => {
        set({ isConnecting: true, error: null });
        try {
          await connectStrava();
          set({ isConnected: true, isConnecting: false });
          logger.info("Strava connected");
          await get().syncNow();
          return true;
        } catch (err) {
          if (err instanceof StravaAuthCancelledError) {
            set({ isConnecting: false });
            return false;
          }
          const errorMsg = err instanceof Error ? err.message : "Failed to connect Strava";
          captureException(err instanceof Error ? err : new Error(errorMsg));
          set({ error: errorMsg, isConnecting: false });
          return false;
        }
      },

      disconnect: async () => {
        try {
          await disconnectStrava();
          set({ isConnected: false, error: null });
        } catch (err) {
          captureException(err instanceof Error ? err : new Error("Strava disconnect failed"));
        }
      },

      syncNow: async () => {
        if (!get().isConnected) return;
        set({ isSyncing: true, error: null });
        try {
          const challengeState = useChallengeStore.getState();
          const challengeId = challengeState.challenge?.$id;
          if (!challengeId) {
            throw new Error("No active challenge to sync into");
          }

          if (!challengeState.todayLog) {
            await challengeState.fetchTodayLog(challengeId);
          }
          const logId = useChallengeStore.getState().todayLog?.$id;
          if (!logId) {
            throw new Error("Could not resolve today's log to sync into");
          }

          // Strava activities are merged into the same slot-assignment pass as
          // HealthKit workouts (see the sourceName filter in resyncHealthDataForDate)
          // so the two sources never race over the same workout1/workout2 slot.
          await useChallengeStore.getState().resyncHealthDataForDate(new Date(), logId);
          set({ isSyncing: false });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Strava sync failed";
          captureException(err instanceof Error ? err : new Error(errorMsg));
          set({ error: errorMsg, isSyncing: false });
        }
      },

      setSyncToAppleHealth: (value: boolean) => set({ syncToAppleHealth: value }),
    }),
    {
      name: "strava-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ syncToAppleHealth: state.syncToAppleHealth }),
    }
  )
);
