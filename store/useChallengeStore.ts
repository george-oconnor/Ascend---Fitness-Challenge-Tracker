import {
    createChallenge,
    createDailyLog,
    getChallenge,
    getDailyLog,
    getDailyLogsForChallenge,
    updateChallenge,
    updateDailyLog,
} from "@/lib/appwrite";
import { captureException } from "@/lib/sentry";
import type { Challenge, DailyLog } from "@/types/type";
import { Platform } from "react-native";
import { create } from "zustand";

type ChallengeState = {
  challenge: Challenge | null;
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchChallenge: (userId: string) => Promise<void>;
  saveChallenge: (challenge: Omit<Challenge, "$id">) => Promise<Challenge>;
  editChallenge: (challengeId: string, data: Partial<Challenge>) => Promise<void>;
  fetchTodayLog: (challengeId: string) => Promise<void>;
  toggleTask: (taskKey: keyof DailyLog, value: boolean) => Promise<void>;
  updateProgress: (progressData: Partial<DailyLog>) => Promise<void>;
  fetchAllLogs: (challengeId: string) => Promise<void>;
  syncHealthData: () => Promise<void>;
  clearChallenge: () => void;
  // Helper for photo completion checking
  isPhotoCompletedWithinDays: (days: number) => boolean;
};

const getTodayDateString = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenge: null,
  todayLog: null,
  allLogs: [],
  isLoading: false,
  error: null,

  fetchChallenge: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const challenge = await getChallenge(userId);
      set({ challenge, isLoading: false });

      // If we have a challenge, fetch today's log
      if (challenge?.$id) {
        await get().fetchTodayLog(challenge.$id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch challenge";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg, isLoading: false });
    }
  },

  saveChallenge: async (challengeData) => {
    set({ isLoading: true, error: null });
    try {
      const challenge = await createChallenge(challengeData);
      set({ challenge, isLoading: false });
      return challenge;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save challenge";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  editChallenge: async (challengeId: string, data: Partial<Challenge>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await updateChallenge(challengeId, data);
      set({ challenge: updated, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update challenge";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  fetchTodayLog: async (challengeId: string) => {
    const today = getTodayDateString();
    try {
      let log = await getDailyLog(challengeId, today);

      // If no log exists for today, create one
      if (!log) {
        const { challenge } = get();
        if (challenge) {
          log = await createDailyLog({
            userId: challenge.userId,
            challengeId,
            date: today,
            stepsCompleted: false,
            stepsCount: 0,
            waterCompleted: false,
            waterLiters: 0,
            dietCompleted: false,
            caloriesConsumed: 0,
            currentWeight: 0,
            workout1Completed: false,
            workout1Minutes: 0,
            workout2Completed: false,
            workout2Minutes: 0,
            readingCompleted: false,
            readingPages: 0,
            progressPhotoCompleted: false,
            noAlcoholCompleted: false,
            meals: "",
          });
        }
      }

      set({ todayLog: log });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch today's log";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("fetchTodayLog error:", err);
    }
  },

  toggleTask: async (taskKey: keyof DailyLog, value: boolean) => {
    const { todayLog, challenge } = get();

    if (!todayLog?.$id || !challenge) return;

    // Optimistic update
    set({ todayLog: { ...todayLog, [taskKey]: value } });

    try {
      const updated = await updateDailyLog(todayLog.$id, { [taskKey]: value });
      set({ todayLog: updated });
    } catch (err) {
      // Rollback on error
      set({ todayLog });
      const errorMsg = err instanceof Error ? err.message : "Failed to update task";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  },

  updateProgress: async (progressData: Partial<DailyLog>) => {
    const { todayLog, challenge } = get();

    if (!todayLog?.$id || !challenge) return;

    // Optimistic update
    set({ todayLog: { ...todayLog, ...progressData } });

    try {
      const updated = await updateDailyLog(todayLog.$id, progressData);
      set({ todayLog: updated });
    } catch (err) {
      // Rollback on error
      set({ todayLog });
      const errorMsg = err instanceof Error ? err.message : "Failed to update progress";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  },

  fetchAllLogs: async (challengeId: string) => {
    try {
      const logs = await getDailyLogsForChallenge(challengeId);
      set({ allLogs: logs });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch logs";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("fetchAllLogs error:", err);
    }
  },

  syncHealthData: async () => {
    const { todayLog, challenge } = get();

    if (!todayLog?.$id || !challenge) {
      console.log("syncHealthData: No todayLog or challenge available");
      return;
    }

    // Only sync on iOS where Apple Health is available
    if (Platform.OS !== "ios") {
      return;
    }

    try {
      // Import health store to get current health data
      const { useHealthStore } = await import("@/store/useHealthStore");
      const healthState = useHealthStore.getState();

      if (!healthState.isAuthorized) {
        console.log("syncHealthData: Apple Health not authorized");
        return;
      }

      const updates: Partial<DailyLog> = {};

      // Sync steps if tracking is enabled
      if (challenge.trackSteps && healthState.steps > 0) {
        const newStepsCount = Math.round(healthState.steps);
        const stepsGoalMet = newStepsCount >= (challenge.stepsGoal || 0);
        
        // Only update if steps changed
        if (newStepsCount !== todayLog.stepsCount) {
          updates.stepsCount = newStepsCount;
          updates.stepsCompleted = stepsGoalMet;
        }
      }

      // Sync water if tracking is enabled
      if (challenge.trackWater) {
        try {
          const { healthSyncService } = await import("@/lib/healthSync");
          const waterData = await healthSyncService.getWaterIntakeForDate(new Date());
          if (waterData.totalLiters > 0) {
            const waterGoalMet = waterData.totalLiters >= (challenge.waterLiters || 0);
            if (waterData.totalLiters !== todayLog.waterLiters) {
              updates.waterLiters = waterData.totalLiters;
              updates.waterCompleted = waterGoalMet;
            }
          }
        } catch (error) {
          console.log("Water sync skipped:", error);
        }
      }

      // Sync sleep if tracking is enabled
      if ((challenge as any).trackSleep) {
        try {
          const { healthSyncService } = await import("@/lib/healthSync");
          const sleepData = await healthSyncService.getSleepForDate(new Date());
          if (sleepData.asleepMinutes > 0) {
            const sleepGoalMinutes = ((challenge as any).sleepGoalHours || 8) * 60;
            const sleepGoalMet = sleepData.asleepMinutes >= sleepGoalMinutes;
            if (sleepData.asleepMinutes !== todayLog.sleepMinutes) {
              updates.sleepMinutes = sleepData.asleepMinutes;
              updates.sleepLogged = sleepGoalMet;
              // Also sync the times if available
              if (sleepData.sleepStart && sleepData.wakeTime) {
                updates.sleepStartTime = sleepData.sleepStart.toISOString();
                updates.sleepEndTime = sleepData.wakeTime.toISOString();
              }
            }
          }
        } catch (error) {
          console.log("Sleep sync skipped:", error);
        }
      }

      // Sync workout data if tracking is enabled
      if (challenge.trackWorkout1 || challenge.trackWorkout2) {
        const workouts = healthState.workouts;
        const workoutGoalMinutes = challenge.workoutMinutes || 45;

        if (workouts.length > 0) {
          // Separate outdoor and indoor workouts
          const outdoorWorkouts = workouts.filter(w => w.isOutdoor);
          const indoorWorkouts = workouts.filter(w => !w.isOutdoor);

          // Calculate total minutes for each type
          const outdoorMinutes = outdoorWorkouts.reduce((sum, w) => sum + w.duration, 0);
          const indoorMinutes = indoorWorkouts.reduce((sum, w) => sum + w.duration, 0);
          const totalMinutes = outdoorMinutes + indoorMinutes;

          // For workout 1, use outdoor workouts
          if (challenge.trackWorkout1) {
            const workout1Minutes = Math.round(outdoorMinutes);
            if (workout1Minutes !== todayLog.workout1Minutes) {
              updates.workout1Minutes = workout1Minutes;
              updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
            }
          }

          // For workout 2, use indoor or remaining total
          if (challenge.trackWorkout2) {
            // If we have both workout types, use indoor for workout 2
            // Otherwise, if only one type and it covers both goals, split it
            let workout2Minutes = 0;
            
            if (challenge.trackWorkout1) {
              // Use indoor workouts for workout 2
              workout2Minutes = Math.round(indoorMinutes);
            } else {
              // If only tracking workout2, use total
              workout2Minutes = Math.round(totalMinutes);
            }
            
            if (workout2Minutes !== todayLog.workout2Minutes) {
              updates.workout2Minutes = workout2Minutes;
              updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
            }
          }
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        console.log("syncHealthData: Updating daily log with:", updates);
        
        // Update local state optimistically
        set({ todayLog: { ...todayLog, ...updates } });

        // Persist to Appwrite
        const updated = await updateDailyLog(todayLog.$id, updates);
        set({ todayLog: updated });
        
        console.log("syncHealthData: Successfully synced health data to Appwrite");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to sync health data";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("syncHealthData error:", err);
    }
  },

  isPhotoCompletedWithinDays: (days: number): boolean => {
    const { allLogs, todayLog } = get();
    if (!todayLog) return false;
    
    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days - 1)); // -1 because we include today
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
    
    // Check if any log from the last X days has a photo
    return allLogs.some(log => 
      log.date >= cutoffDateStr && (log.progressPhotoCompleted ?? false)
    );
  },

  clearChallenge: () => {
    set({ challenge: null, todayLog: null, allLogs: [], error: null });
  },
}));
