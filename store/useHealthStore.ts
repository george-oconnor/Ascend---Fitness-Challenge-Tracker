import { healthService, WorkoutData } from "@/lib/health";
import { captureException, logger } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Platform } from "react-native";
import { create } from "zustand";

type HealthState = {
  isNativeModuleAvailable: boolean;
  isAvailable: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
  steps: number;
  workouts: WorkoutData[];
  error: string | null;
  isBackgroundSyncEnabled: boolean;

  // Actions
  initialize: () => Promise<boolean>;
  fetchTodayData: () => Promise<void>;
  checkStepGoal: (goal: number) => boolean;
  getOutdoorWorkoutMinutes: () => number;
  getTotalWorkoutMinutes: () => number;
  enableHealthBackgroundSync: () => Promise<void>;
};

const STEPS_MILESTONE_INTERVAL = 2000;

export const useHealthStore = create<HealthState>((set, get) => ({
  // Don't call isNativeModuleLinked at store creation - it's called lazily now
  isNativeModuleAvailable: false,
  isAvailable: false,
  isAuthorized: false,
  isLoading: false,
  steps: 0,
  workouts: [],
  error: null,
  isBackgroundSyncEnabled: false,

  initialize: async () => {
    set({ isLoading: true, error: null });
    
    logger.info("HealthKit initialization started");
    
    // Check if native module is available (this triggers lazy loading)
    const isLinked = healthService.isNativeModuleLinked();
    set({ isNativeModuleAvailable: isLinked });
    
    logger.info("HealthKit module check", { isLinked });
    
    if (!isLinked) {
      const loadError = healthService.getModuleLoadError();
      set({ 
        error: loadError || "Apple Health requires a development or TestFlight build.",
        isLoading: false,
        isNativeModuleAvailable: false,
      });
      logger.warn("HealthKit module not linked", { loadError });
      console.log("HealthKit module not linked. Error:", loadError);
      return false;
    }
    
    try {
      const authorized = await healthService.initialize();
      logger.info("HealthKit authorization result", { authorized });
      set({ 
        isAuthorized: authorized, 
        isAvailable: true,
        isLoading: false 
      });
      
      if (authorized) {
        // Fetch today's data after initialization
        await get().fetchTodayData();
      } else {
        logger.warn("HealthKit authorization denied");
      }
      
      return authorized;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to initialize HealthKit";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      logger.error("HealthKit initialization failed", { error: errorMsg });
      set({ error: errorMsg, isLoading: false, isAvailable: false });
      return false;
    }
  },

  fetchTodayData: async () => {
    console.log("🏃 fetchTodayData: Starting fetch...");
    logger.info("Fetching today health data");
    set({ isLoading: true, error: null });
    try {
      const data = await healthService.getTodayHealthData();
      logger.info("Health data fetched", {
        steps: data.steps,
        workoutsCount: data.workouts.length,
        isAvailable: data.isAvailable,
        isAuthorized: data.isAuthorized,
      });
      console.log("🏃 fetchTodayData: Got data:", {
        steps: data.steps,
        workoutsCount: data.workouts.length,
        workouts: data.workouts.map(w => ({ name: w.activityName, duration: w.duration })),
      });
      set({
        steps: data.steps,
        workouts: data.workouts,
        isAvailable: data.isAvailable,
        isAuthorized: data.isAuthorized,
        isLoading: false,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch health data";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("❌ fetchTodayData error:", errorMsg);
      set({ error: errorMsg, isLoading: false });
    }
  },

  checkStepGoal: (goal: number) => {
    return get().steps >= goal;
  },

  getOutdoorWorkoutMinutes: () => {
    const workouts = get().workouts;
    if (!workouts || !Array.isArray(workouts)) return 0;
    return workouts
      .filter((w) => w?.isOutdoor)
      .reduce((total, w) => total + (w?.duration || 0), 0);
  },

  getTotalWorkoutMinutes: () => {
    const workouts = get().workouts;
    if (!workouts || !Array.isArray(workouts)) return 0;
    return workouts.reduce((total, w) => total + (w?.duration || 0), 0);
  },

  /**
   * Enables HealthKit background delivery for workouts, water, sleep,
   * weight, mood, and steps, so data logged elsewhere (e.g. an Apple Watch,
   * or the Health app directly) while this app is closed gets pulled in.
   * Steps use 'hourly' delivery (not 'immediate') since it's a
   * high-frequency type — Apple discourages waking the app on every step.
   *
   * Every wake-up triggers a resync, but only fires a notification for
   * genuinely new "obvious points": a workout appearing, a goal being
   * reached (water/sleep/steps), a weight entry landing, a step-count
   * milestone, or the whole day completing — not on every silent no-op sync.
   * Safe to call more than once; only sets up subscriptions the first time.
   */
  enableHealthBackgroundSync: async () => {
    if (get().isBackgroundSyncEnabled) return;
    if (Platform.OS !== "ios") return;

    try {
      const { healthSyncService, HealthKitBackgroundTypes } = await import("@/lib/healthSync");

      const handleChange = async () => {
        try {
          const challengeState = useChallengeStore.getState();
          const challenge = challengeState.challenge;
          const challengeId = challenge?.$id;
          if (!challengeId || !challenge) return;

          if (!challengeState.todayLog) {
            await challengeState.fetchTodayLog(challengeId);
          }
          const before = useChallengeStore.getState().todayLog;
          const logId = before?.$id;
          if (!logId) return;

          await useChallengeStore.getState().resyncHealthDataForDate(new Date(), logId);
          const after = useChallengeStore.getState().todayLog;
          if (!after) return;

          const { NotificationService } = await import("@/lib/notifications");
          const { useNotificationStore } = await import("@/store/useNotificationStore");
          const { isDayComplete } = await import("@/lib/dayCompletion");
          const notificationStore = useNotificationStore.getState();
          const today = new Date().toISOString().split("T")[0];

          // Workouts: notify on any minutes growth in a slot (a workout was detected)
          for (const slot of ["workout1", "workout2"] as const) {
            const grew = (after[`${slot}Minutes`] ?? 0) > (before?.[`${slot}Minutes`] ?? 0);
            if (!grew) continue;
            try {
              const details = after.workoutDetails ? JSON.parse(after.workoutDetails) : {};
              await NotificationService.notifyWorkoutDetected(
                after[`${slot}Minutes`] ?? 0,
                details[slot]?.activityName
              );
            } catch (err) {
              logger.warn("Background workout notification failed", { error: String(err) });
            }
          }

          // Water goal
          if (after.waterCompleted && !before?.waterCompleted && !notificationStore.hasNotifiedWaterGoal(today)) {
            notificationStore.markWaterGoalNotified(today);
            await NotificationService.notifyWaterGoalReached(after.waterLiters ?? 0);
          }

          // Sleep goal
          if (after.sleepCompleted && !before?.sleepCompleted && !notificationStore.hasNotifiedSleepGoal(today)) {
            notificationStore.markSleepGoalNotified(today);
            await NotificationService.notifySleepGoalReached(after.sleepMinutes ?? 0);
          }

          // Weight logged
          if (after.weightLogged && !before?.weightLogged && !notificationStore.hasNotifiedWeightLogged(today)) {
            notificationStore.markWeightLoggedNotified(today);
            await NotificationService.notifyWeightLogged(after.currentWeight ?? 0);
          }

          // Steps: full goal reached, or a discrete "remaining" milestone
          if (challenge.trackSteps && after.stepsCount) {
            const goal = challenge.stepsGoal || 10000;
            if (after.stepsCompleted && !before?.stepsCompleted) {
              if (!notificationStore.hasNotifiedStepGoal(today)) {
                notificationStore.markStepGoalNotified(today);
                await NotificationService.notifyStepGoalReached(after.stepsCount, goal);
              }
            } else {
              const remaining = Math.max(0, goal - after.stepsCount);
              const bucket = Math.floor(remaining / STEPS_MILESTONE_INTERVAL) * STEPS_MILESTONE_INTERVAL;
              if (bucket > 0 && bucket < goal && !notificationStore.hasNotifiedStepsMilestone(today, bucket)) {
                notificationStore.markStepsMilestoneNotified(today, bucket);
                await NotificationService.notifyStepsMilestone(bucket);
              }
            }
          }

          // Day complete — shares the same dedup the in-app toggle path uses,
          // so whichever path detects it first "wins" and the other stays quiet.
          if (
            isDayComplete(challenge, after, challengeState.allLogs) &&
            !notificationStore.hasNotifiedDayComplete(today)
          ) {
            notificationStore.markDayCompleteNotified(today);
            await NotificationService.notifyDayComplete();
          }
        } catch (err) {
          captureException(err instanceof Error ? err : new Error("Background health sync handler failed"));
        }
      };

      const types = Object.values(HealthKitBackgroundTypes);
      const results = await Promise.all(
        types.map((typeIdentifier) =>
          healthSyncService.enableBackgroundDeliveryFor(
            typeIdentifier,
            typeIdentifier === HealthKitBackgroundTypes.Steps ? "hourly" : "immediate"
          )
        )
      );

      for (const typeIdentifier of types) {
        healthSyncService.subscribeToTypeChanges(typeIdentifier, () => {
          handleChange();
        });
      }

      if (results.some(Boolean)) {
        set({ isBackgroundSyncEnabled: true });
        logger.info("HealthKit background sync enabled", { types });
      }
    } catch (err) {
      captureException(err instanceof Error ? err : new Error("Failed to enable health background sync"));
    }
  },
}));
