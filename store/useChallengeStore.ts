import {
    createActivityLog,
    createChallenge,
    createDailyLog,
    deleteActivityLog,
    getActivityLogsForChallenge,
    getActivityLogsForDate,
    getChallenge,
    getDailyLog,
    getDailyLogsForChallenge,
    updateActivityLog,
    updateChallenge,
    updateDailyLog
} from "@/lib/cloudkit";
import { isDayComplete } from "@/lib/dayCompletion";
import type { MergedWorkout } from "@/lib/mergedWorkouts";
import { NotificationService } from "@/lib/notifications";
import { captureException, logger } from "@/lib/sentry";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { ActivityLog, ActivityType, Challenge, DailyLog } from "@/types/type";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, subDays } from "date-fns";
import { Platform } from "react-native";
import { create } from "zustand";

const LAST_HEALTH_FINALIZE_DATE_KEY = "lastHealthFinalizeDate";

// Keyed by `${challengeId}:${dateStr}`. resyncHealthDataForDate reads
// "existing activity logs" up front and only creates-vs-updates once its slow
// HealthKit/Strava fetches finish, so concurrent triggers for the same day
// (a Strava webhook retry, HealthKit background delivery, and a manual "Sync
// Now" landing close together) would each see no existing log yet and each
// create their own — see resyncHealthDataForDate below.
const resyncInFlight = new Map<string, Promise<void>>();

/**
 * Set forceStravaFetch for user- or event-triggered syncs (a refresh tap,
 * "Sync Now", a Strava webhook push) so they bypass the Strava activity cache
 * in lib/mergedWorkouts and see changes — including deletions — immediately.
 */
type SyncOptions = { forceStravaFetch?: boolean };

type ChallengeState = {
  challenge: Challenge | null;
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  activityLogs: ActivityLog[];
  /**
   * The reconciled HealthKit + Strava workout list behind today's workout
   * slots, as of the last resync. Null until a resync has run. The daily log
   * renders this rather than raw HealthKit data so a workout deleted in
   * Strava disappears from the list, not just from the progress numbers.
   */
  todayWorkouts: MergedWorkout[] | null;
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
  fetchActivityLogs: (challengeId: string) => Promise<void>;
  logActivity: (activity: {
    type: ActivityType;
    title: string;
    description: string;
    value?: number;
    unit?: string;
    /** Defaults to today if omitted — pass this when logging/editing a past day. */
    date?: string;
  }) => Promise<void>;
  syncHealthData: (options?: SyncOptions) => Promise<void>;
  resyncHealthDataForDate: (
    date: Date,
    logId: string,
    logCallback?: (message: string) => void,
    options?: SyncOptions
  ) => Promise<void>;
  deleteActivityLogById: (logId: string) => Promise<void>;
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
  activityLogs: [],
  todayWorkouts: null,
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
      logger.info("Challenge created", { challengeId: challenge.$id, userId: challengeData.userId });
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
        // The day just rolled over (or this is the very first launch) — take
        // one last pass at yesterday's log before moving on, since background
        // HealthKit delivery for steps is sparse and whatever count landed
        // last would otherwise be frozen as the permanent historical record.
        finalizePreviousDayHealthDataIfNeeded(challengeId);

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
            skincareCompleted: false,
            meals: "",
          }, challenge.userId);
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
    const { todayLog, challenge, allLogs } = get();

    if (!todayLog?.$id || !challenge) return;

    // Optimistic update
    set({ todayLog: { ...todayLog, [taskKey]: value } });

    try {
      const updated = await updateDailyLog(todayLog.$id, { [taskKey]: value });
      set({ todayLog: updated });
      
      // Check if day is now complete after this toggle
      if (value && isDayComplete(challenge, updated, allLogs)) {
        const notificationStore = useNotificationStore.getState();
        const today = new Date().toISOString().split("T")[0];
        const wasNotified = notificationStore.hasNotifiedDayComplete(today);
        if (!wasNotified) {
          notificationStore.markDayCompleteNotified(today);
          await NotificationService.notifyDayComplete();
          // Add to in-app notification tray
          notificationStore.addNotification({
            type: "day_complete",
            title: "✅ Day Complete!",
            body: "Amazing work! You completed all your tasks today!",
            icon: "check-circle",
            color: "#10B981",
          });
        }
      }
    } catch (err) {
      // Rollback on error
      set({ todayLog });
      const errorMsg = err instanceof Error ? err.message : "Failed to update task";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  },

  updateProgress: async (progressData: Partial<DailyLog>) => {
    const { todayLog, challenge, allLogs } = get();

    if (!todayLog?.$id || !challenge) return;

    // Optimistic update
    set({ todayLog: { ...todayLog, ...progressData } });

    try {
      const updated = await updateDailyLog(todayLog.$id, progressData);
      set({ todayLog: updated });
      
      // Check if day is now complete after this progress update
      if (isDayComplete(challenge, updated, allLogs)) {
        const notificationStore = useNotificationStore.getState();
        const today = new Date().toISOString().split("T")[0];
        const wasNotified = notificationStore.hasNotifiedDayComplete(today);
        if (!wasNotified) {
          notificationStore.markDayCompleteNotified(today);
          await NotificationService.notifyDayComplete();
          // Add to in-app notification tray
          notificationStore.addNotification({
            type: "day_complete",
            title: "✅ Day Complete!",
            body: "Amazing work! You completed all your tasks today!",
            icon: "check-circle",
            color: "#10B981",
          });
        }
      }
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

  fetchActivityLogs: async (challengeId: string) => {
    try {
      const logs = await getActivityLogsForChallenge(challengeId);
      set({ activityLogs: logs });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch activity logs";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("fetchActivityLogs error:", err);
    }
  },

  logActivity: async (activity) => {
    const { challenge, activityLogs } = get();
    
    if (!challenge?.$id) {
      console.log("logActivity: No challenge available");
      return;
    }

    try {
      const newLog = await createActivityLog({
        userId: challenge.userId,
        challengeId: challenge.$id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        value: activity.value,
        unit: activity.unit,
        date: activity.date || getTodayDateString(),
      });
      
      // Add to local state (prepend since it's newest)
      set({ activityLogs: [newLog, ...activityLogs] });
      
      logger.info("Activity logged", { 
        type: activity.type, 
        challengeId: challenge.$id,
        value: activity.value 
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to log activity";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.error("logActivity error:", err);
    }
  },

  resyncHealthDataForDate: async (
    date: Date,
    logId: string,
    logCallback?: (message: string) => void,
    options?: SyncOptions
  ) => {
    const { challenge } = get();
    const log = (msg: string) => {
      console.log(msg);
      logCallback?.(msg);
    };

    if (!challenge || !challenge.$id) {
      log("resyncHealthDataForDate: No challenge available");
      return;
    }

    const challengeId = challenge.$id;

    // Only sync on iOS where Apple Health is available
    if (Platform.OS !== "ios") {
      log("⚠️ Resync only available on iOS");
      return;
    }

    // Coalesce concurrent calls for the same challenge+date into one run
    // instead of racing (see resyncInFlight comment above).
    const dateStr = format(date, 'yyyy-MM-dd');
    const lockKey = `${challengeId}:${dateStr}`;
    const existingRun = resyncInFlight.get(lockKey);
    if (existingRun) {
      log(`⏳ Resync already running for ${dateStr}, waiting on it instead of racing`);
      return existingRun;
    }

    const run = (async () => {
    try {
      const { healthService } = await import("@/lib/health");
      const { getMergedWorkoutsForDate } = await import("@/lib/mergedWorkouts");

      log(`📅 Fetching health data for ${format(date, 'MMM dd, yyyy')}...`);

      // Sorted chronologically, HealthKit and Strava already de-duplicated.
      const mergedWorkouts = await getMergedWorkoutsForDate(date, {
        log,
        forceStravaFetch: options?.forceStravaFetch,
      });

      // Publish the list the daily log renders, so a workout deleted in Strava
      // disappears from "Today's Workouts" at the same moment its minutes drop
      // out of the workout slots below.
      if (format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
        set({ todayWorkouts: mergedWorkouts });
      }

      // If the user has opted in (Strava settings), also write Strava-sourced
      // workouts into Apple Health with the correct type — for people who've
      // turned off Strava's own native Health sync in favor of Ascend's.
      const syncStravaToHealthKit = async (workout: MergedWorkout) => {
        if (workout.source !== 'strava') return;
        try {
          const { useStravaStore } = await import("@/store/useStravaStore");
          if (!useStravaStore.getState().syncToAppleHealth) return;
          await healthService.saveWorkout({
            type: workout.typeId,
            startDate: new Date(workout.startDate),
            endDate: new Date(workout.endDate),
            calories: workout.calories,
            distance: workout.distance,
          });
        } catch (err) {
          log(`⚠️ Failed to write Strava workout to Apple Health: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      };

      const updates: Partial<DailyLog> = {};
      const activityLogsToCreate: Omit<ActivityLog, "$id">[] = [];
      const activityLogsToUpdate: { id: string; data: Partial<ActivityLog> }[] = [];
      const activityLogsToDelete: string[] = [];

      // Fetch existing workout activity logs for this date
      const existingWorkout1Logs = await getActivityLogsForDate(challengeId, dateStr, 'workout1');
      const existingWorkout2Logs = await getActivityLogsForDate(challengeId, dateStr, 'workout2');
      
      log(`📋 Found ${existingWorkout1Logs.length} existing workout1 log(s), ${existingWorkout2Logs.length} existing workout2 log(s)`);
      
      // Sync workout data
      if (challenge.trackWorkout1 || challenge.trackWorkout2) {
        const workoutGoalMinutes = challenge.workoutMinutes || 45;
        
        // Sort workouts by start time (earliest first)
        const sortedWorkouts = [...mergedWorkouts].sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

        if (challenge.trackWorkout1 && challenge.trackWorkout2) {
          // Tracking both workouts - 1:1 assignment
          let workout1Minutes = 0;
          let workout2Minutes = 0;
          
          // Simple 1:1 assignment: first workout → slot 1, second workout → slot 2
          if (sortedWorkouts.length >= 1) {
            workout1Minutes = Math.round(sortedWorkouts[0].duration);
          }
          if (sortedWorkouts.length >= 2) {
            workout2Minutes = Math.round(sortedWorkouts[1].duration);
          }
          // If only 1 workout exists, workout2Minutes stays 0 (clears any incorrect assignment)
          
          log(`💪 Workout 1: ${workout1Minutes} min ${workout1Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
          log(`💪 Workout 2: ${workout2Minutes} min ${workout2Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
          
          // Always update both - this ensures incorrect values get cleared
          updates.workout1Minutes = workout1Minutes;
          updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
          updates.workout2Minutes = workout2Minutes;
          updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
          
          // Build workoutDetails JSON with all Apple Health data
          const workoutDetailsObj: Record<string, any> = {};
          
          if (workout1Minutes > 0 && sortedWorkouts.length >= 1) {
            const w1 = sortedWorkouts[0];
            const notesArr = [
              w1.calories ? `${Math.round(w1.calories)} calories burned` : null,
              w1.distance ? `${(w1.distance / 1000).toFixed(2)}km distance` : null,
              w1.isOutdoor ? 'Outdoor workout' : 'Indoor workout',
              `Started: ${format(new Date(w1.startDate), 'h:mm a')}`,
              `Ended: ${format(new Date(w1.endDate), 'h:mm a')}`,
            ].filter(Boolean).join(' • ');
            
            workoutDetailsObj.workout1 = {
              type: w1.typeId,
              notes: notesArr,
              syncedFromHealth: true,
              syncedFromStrava: w1.source === 'strava',
              activityName: w1.activityName,
              calories: w1.calories ? Math.round(w1.calories) : undefined,
              distance: w1.distance ? (w1.distance / 1000).toFixed(2) : undefined,
              isOutdoor: w1.isOutdoor,
              startTime: w1.startDate,
              endTime: w1.endDate,
            };
            await syncStravaToHealthKit(w1);

            // Manage workout1 activity log
            const workout1LogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'workout1' as const,
              title: `${w1.activityName} (Workout 1)`,
              description: `${workout1Minutes} min - ${notesArr}`,
              value: workout1Minutes,
              unit: 'min',
              date: dateStr,
              source: w1.source,
              externalId: w1.externalId,
            };
            
            if (existingWorkout1Logs.length > 0) {
              // Update existing log
              activityLogsToUpdate.push({ id: existingWorkout1Logs[0].$id!, data: workout1LogData });
            } else {
              // Create new log
              activityLogsToCreate.push(workout1LogData);
            }
          } else {
            // No workout 1 - delete existing activity log if any
            for (const existingLog of existingWorkout1Logs) {
              if (existingLog.$id) {
                activityLogsToDelete.push(existingLog.$id);
              }
            }
          }
          
          if (workout2Minutes > 0 && sortedWorkouts.length >= 2) {
            const w2 = sortedWorkouts[1];
            const notesArr = [
              w2.calories ? `${Math.round(w2.calories)} calories burned` : null,
              w2.distance ? `${(w2.distance / 1000).toFixed(2)}km distance` : null,
              w2.isOutdoor ? 'Outdoor workout' : 'Indoor workout',
              `Started: ${format(new Date(w2.startDate), 'h:mm a')}`,
              `Ended: ${format(new Date(w2.endDate), 'h:mm a')}`,
            ].filter(Boolean).join(' • ');
            
            workoutDetailsObj.workout2 = {
              type: w2.typeId,
              notes: notesArr,
              syncedFromHealth: true,
              syncedFromStrava: w2.source === 'strava',
              activityName: w2.activityName,
              calories: w2.calories ? Math.round(w2.calories) : undefined,
              distance: w2.distance ? (w2.distance / 1000).toFixed(2) : undefined,
              isOutdoor: w2.isOutdoor,
              startTime: w2.startDate,
              endTime: w2.endDate,
            };
            await syncStravaToHealthKit(w2);

            // Manage workout2 activity log
            const workout2LogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'workout2' as const,
              title: `${w2.activityName} (Workout 2)`,
              description: `${workout2Minutes} min - ${notesArr}`,
              value: workout2Minutes,
              unit: 'min',
              date: dateStr,
              source: w2.source,
              externalId: w2.externalId,
            };
            
            if (existingWorkout2Logs.length > 0) {
              // Update existing log
              activityLogsToUpdate.push({ id: existingWorkout2Logs[0].$id!, data: workout2LogData });
            } else {
              // Create new log
              activityLogsToCreate.push(workout2LogData);
            }
          } else {
            // No workout 2 - delete existing activity log if any
            for (const existingLog of existingWorkout2Logs) {
              if (existingLog.$id) {
                activityLogsToDelete.push(existingLog.$id);
              }
            }
          }
          
          // Update workoutDetails in the daily log
          updates.workoutDetails = JSON.stringify(workoutDetailsObj);
          
        } else if (challenge.trackWorkout1) {
          // Only tracking workout1
          const workout1Minutes = sortedWorkouts.length >= 1 ? Math.round(sortedWorkouts[0].duration) : 0;
          
          log(`💪 Workout 1: ${workout1Minutes} min ${workout1Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
          
          updates.workout1Minutes = workout1Minutes;
          updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
          
          if (workout1Minutes > 0 && sortedWorkouts.length >= 1) {
            const w = sortedWorkouts[0];
            const notesArr = [
              w.calories ? `${Math.round(w.calories)} calories burned` : null,
              w.distance ? `${(w.distance / 1000).toFixed(2)}km distance` : null,
              w.isOutdoor ? 'Outdoor workout' : 'Indoor workout',
              `Started: ${format(new Date(w.startDate), 'h:mm a')}`,
              `Ended: ${format(new Date(w.endDate), 'h:mm a')}`,
            ].filter(Boolean).join(' • ');
            
            updates.workoutDetails = JSON.stringify({
              workout1: {
                type: w.typeId,
                notes: notesArr,
                syncedFromHealth: true,
                syncedFromStrava: w.source === 'strava',
                activityName: w.activityName,
                calories: w.calories ? Math.round(w.calories) : undefined,
                distance: w.distance ? (w.distance / 1000).toFixed(2) : undefined,
                isOutdoor: w.isOutdoor,
                startTime: w.startDate,
                endTime: w.endDate,
              }
            });
            await syncStravaToHealthKit(w);

            // Manage workout1 activity log
            const workout1LogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'workout1' as const,
              title: `${w.activityName} (Workout 1)`,
              description: `${workout1Minutes} min - ${notesArr}`,
              value: workout1Minutes,
              unit: 'min',
              date: dateStr,
              source: w.source,
              externalId: w.externalId,
            };
            
            if (existingWorkout1Logs.length > 0) {
              activityLogsToUpdate.push({ id: existingWorkout1Logs[0].$id!, data: workout1LogData });
            } else {
              activityLogsToCreate.push(workout1LogData);
            }
          } else {
            // No workout - delete existing activity log if any
            for (const existingLog of existingWorkout1Logs) {
              if (existingLog.$id) {
                activityLogsToDelete.push(existingLog.$id);
              }
            }
          }
          
        } else if (challenge.trackWorkout2) {
          // Only tracking workout2
          const workout2Minutes = sortedWorkouts.length >= 1 ? Math.round(sortedWorkouts[0].duration) : 0;
          
          log(`💪 Workout 2: ${workout2Minutes} min ${workout2Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
          
          updates.workout2Minutes = workout2Minutes;
          updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
          
          if (workout2Minutes > 0 && sortedWorkouts.length >= 1) {
            const w = sortedWorkouts[0];
            const notesArr = [
              w.calories ? `${Math.round(w.calories)} calories burned` : null,
              w.distance ? `${(w.distance / 1000).toFixed(2)}km distance` : null,
              w.isOutdoor ? 'Outdoor workout' : 'Indoor workout',
              `Started: ${format(new Date(w.startDate), 'h:mm a')}`,
              `Ended: ${format(new Date(w.endDate), 'h:mm a')}`,
            ].filter(Boolean).join(' • ');
            
            updates.workoutDetails = JSON.stringify({
              workout2: {
                type: w.typeId,
                notes: notesArr,
                syncedFromHealth: true,
                syncedFromStrava: w.source === 'strava',
                activityName: w.activityName,
                calories: w.calories ? Math.round(w.calories) : undefined,
                distance: w.distance ? (w.distance / 1000).toFixed(2) : undefined,
                isOutdoor: w.isOutdoor,
                startTime: w.startDate,
                endTime: w.endDate,
              }
            });
            await syncStravaToHealthKit(w);

            // Manage workout2 activity log
            const workout2LogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'workout2' as const,
              title: `${w.activityName} (Workout 2)`,
              description: `${workout2Minutes} min - ${notesArr}`,
              value: workout2Minutes,
              unit: 'min',
              date: dateStr,
              source: w.source,
              externalId: w.externalId,
            };
            
            if (existingWorkout2Logs.length > 0) {
              activityLogsToUpdate.push({ id: existingWorkout2Logs[0].$id!, data: workout2LogData });
            } else {
              activityLogsToCreate.push(workout2LogData);
            }
          } else {
            // No workout - delete existing activity log if any
            for (const existingLog of existingWorkout2Logs) {
              if (existingLog.$id) {
                activityLogsToDelete.push(existingLog.$id);
              }
            }
          }
        }
        
        if (mergedWorkouts.length === 0) {
          log("⚠️ No workouts found for this date");
        }
      }

      // Sync water data
      if ((challenge as any).trackWater) {
        try {
          log("💧 Fetching water data...");
          const { healthSyncService } = await import("@/lib/healthSync");
          const waterLiters = await healthSyncService.getWaterIntakeForDate(date);
          if (waterLiters && waterLiters > 0) {
            const waterGoal = (challenge as any).waterGoalLiters || 3.7;
            const waterGoalMet = waterLiters >= waterGoal;

            log(`💧 Water: ${waterLiters.toFixed(2)}L ${waterGoalMet ? '✅' : '❌'}`);

            updates.waterLiters = waterLiters;
            updates.waterCompleted = waterGoalMet;

            const waterLogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'water' as const,
              title: 'Water Intake (Resync)',
              description: `${waterLiters.toFixed(2)}L from Apple Health`,
              value: waterLiters,
              unit: 'L',
              date: dateStr,
            };
            const existingWaterLogs = await getActivityLogsForDate(challengeId, dateStr, 'water');
            if (existingWaterLogs.length > 0) {
              activityLogsToUpdate.push({ id: existingWaterLogs[0].$id!, data: waterLogData });
            } else {
              activityLogsToCreate.push(waterLogData);
            }
          } else {
            log("💧 No water data found");
          }
        } catch (error) {
          log("💧 Water sync skipped: " + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }

      // Sync sleep data
      if ((challenge as any).trackSleep) {
        try {
          log("😴 Fetching sleep data...");
          const { healthSyncService } = await import("@/lib/healthSync");
          const sleepData = await healthSyncService.getSleepForDate(date);
          if (sleepData && sleepData.asleepMinutes > 0) {
            const sleepGoalMinutes = ((challenge as any).sleepGoalHours || 8) * 60;
            const sleepGoalMet = sleepData.asleepMinutes >= sleepGoalMinutes;
            const sleepHours = Math.floor(sleepData.asleepMinutes / 60);
            const sleepMins = sleepData.asleepMinutes % 60;

            log(`😴 Sleep: ${sleepHours}h ${sleepMins}m ${sleepGoalMet ? '✅' : '❌'}`);

            updates.sleepMinutes = sleepData.asleepMinutes;
            updates.sleepLogged = true;
            updates.sleepCompleted = sleepGoalMet;
            if (sleepData.startTime && sleepData.endTime) {
              updates.sleepStartTime = sleepData.startTime.toISOString();
              updates.sleepEndTime = sleepData.endTime.toISOString();
            }

            const sleepLogData = {
              userId: challenge.userId,
              challengeId: challengeId,
              type: 'sleep' as const,
              title: 'Sleep (Resync)',
              description: `${sleepHours}h ${sleepMins}m from Apple Health`,
              value: sleepData.asleepMinutes,
              unit: 'min',
              date: dateStr,
            };
            const existingSleepLogs = await getActivityLogsForDate(challengeId, dateStr, 'sleep');
            if (existingSleepLogs.length > 0) {
              activityLogsToUpdate.push({ id: existingSleepLogs[0].$id!, data: sleepLogData });
            } else {
              activityLogsToCreate.push(sleepLogData);
            }
          } else {
            log("😴 No sleep data found");
          }
        } catch (error) {
          log("😴 Sleep sync skipped: " + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }

      // Sync steps data - always pull from Apple Health for display
      try {
        log("👟 Fetching steps data...");
        const { healthService } = await import("@/lib/health");
        const stepsCount = await healthService.getStepsForDate(date);
        if (stepsCount > 0) {
          const stepsGoal = (challenge as any).stepsGoal || 10000;
          const stepsGoalMet = stepsCount >= stepsGoal;
          const isTracking = (challenge as any).trackSteps;

          log(`👟 Steps: ${stepsCount.toLocaleString()} ${stepsGoalMet ? '✅' : '❌'} ${isTracking ? '(tracked)' : '(display only)'}`);

          updates.stepsCount = stepsCount;
          // Only mark as completed if we're tracking steps
          if (isTracking) {
            updates.stepsCompleted = stepsGoalMet;
          }

          const stepsLogData = {
            userId: challenge.userId,
            challengeId: challengeId,
            type: 'steps' as const,
            title: isTracking ? 'Steps (Resync)' : 'Steps (Auto-sync)',
            description: `${stepsCount.toLocaleString()} steps from Apple Health${isTracking ? '' : ' (display only)'}`,
            value: stepsCount,
            unit: 'steps',
            date: dateStr,
          };
          const existingStepsLogs = await getActivityLogsForDate(challengeId, dateStr, 'steps');
          if (existingStepsLogs.length > 0) {
            activityLogsToUpdate.push({ id: existingStepsLogs[0].$id!, data: stepsLogData });
          } else {
            activityLogsToCreate.push(stepsLogData);
          }
        } else {
          log("👟 No steps data found");
        }
      } catch (error) {
        log("👟 Steps sync skipped: " + (error instanceof Error ? error.message : 'Unknown error'));
      }

      // Sync weight data — logged, not goal-based day-to-day (weightGoal is an
      // overall challenge target, not something to hit every single day)
      if ((challenge as any).trackWeight) {
        try {
          log("⚖️ Fetching weight data...");
          const { healthSyncService } = await import("@/lib/healthSync");
          const weightKg = await healthSyncService.getWeightForDate(date);
          if (weightKg && weightKg > 0) {
            log(`⚖️ Weight: ${weightKg.toFixed(1)}kg`);
            updates.currentWeight = weightKg;
            updates.weightLogged = true;
          } else {
            log("⚖️ No weight data found");
          }
        } catch (error) {
          log("⚖️ Weight sync skipped: " + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }

      // Sync mood data — logged only, no goal concept for mood
      if ((challenge as any).trackMood) {
        try {
          log("🙂 Fetching mood data...");
          const { healthSyncService } = await import("@/lib/healthSync");
          const moodData = await healthSyncService.getMoodForDate(date);
          if (moodData) {
            log(`🙂 Mood: ${moodData.score}`);
            updates.moodScore = moodData.score;
          } else {
            log("🙂 No mood data found");
          }
        } catch (error) {
          log("🙂 Mood sync skipped: " + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        log(`💾 Updating daily log...`);
        
        // Persist
        const updated = await updateDailyLog(logId, updates);
        
        // Update local state if this is today's log
        const { todayLog } = get();
        if (todayLog?.$id === logId) {
          set({ todayLog: updated });
        }
        
        // Refresh all logs to update the list
        const allLogs = await getDailyLogsForChallenge(challengeId);
        set({ allLogs });
        
        log(`✅ Daily log updated successfully`);
      } else {
        log("ℹ️ No changes needed");
      }
      
      // Create, update, and delete activity logs
      const hasActivityLogChanges =
        activityLogsToCreate.length > 0 || activityLogsToUpdate.length > 0 || activityLogsToDelete.length > 0;

      if (activityLogsToCreate.length > 0) {
        log(`📝 Creating ${activityLogsToCreate.length} activity log(s)...`);
        for (const activityLog of activityLogsToCreate) {
          await createActivityLog(activityLog);
          log(`✅ Created: ${activityLog.title}`);
        }
      }

      if (activityLogsToUpdate.length > 0) {
        log(`📝 Updating ${activityLogsToUpdate.length} activity log(s)...`);
        for (const { id, data } of activityLogsToUpdate) {
          await updateActivityLog(id, data);
          log(`✅ Updated: ${data.title}`);
        }
      }

      if (activityLogsToDelete.length > 0) {
        log(`🗑️ Removing ${activityLogsToDelete.length} stale activity log(s)...`);
        for (const id of activityLogsToDelete) {
          await deleteActivityLog(id);
        }
      }

      if (hasActivityLogChanges) {
        // Refresh activity logs to reflect the changes
        const refreshedActivityLogs = await getActivityLogsForChallenge(challengeId);
        set({ activityLogs: refreshedActivityLogs });
        log(`🔄 Activity logs refreshed`);
      } else {
        log(`ℹ️ No activity logs to create, update, or delete`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to re-sync health data";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      log(`❌ Error: ${errorMsg}`);
      throw err;
    }
    })();

    resyncInFlight.set(lockKey, run);
    try {
      await run;
    } finally {
      resyncInFlight.delete(lockKey);
    }
  },

  syncHealthData: async (options?: SyncOptions) => {
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

      // Strava is a source in its own right — a user who connected Strava but
      // declined Apple Health still has workouts to sync.
      const { isStravaConnected } = await import("@/lib/strava");
      const stravaConnected = await isStravaConnected();

      if (!healthState.isAuthorized && !stravaConnected) {
        console.log("syncHealthData: No health source connected");
        return;
      }

      // Workouts are reconciled across HealthKit and Strava, so hand the whole
      // job to resyncHealthDataForDate rather than duplicating that logic here
      // — it covers steps/water/sleep too, and creates the activity logs
      // without duplication. Done up front so the HealthKit-only work below
      // isn't computed and then thrown away by the early return.
      const hasWorkoutTracking = challenge.trackWorkout1 || challenge.trackWorkout2;
      console.log("🏋️ syncHealthData: Checking workout sync", {
        trackWorkout1: challenge.trackWorkout1,
        trackWorkout2: challenge.trackWorkout2,
        workoutsCount: healthState.workouts.length,
        stravaConnected,
      });

      // Strava can hold workouts HealthKit knows nothing about, so being
      // connected is reason enough to resync — waiting for a HealthKit workout
      // to show up would strand a Strava-only user with an empty log.
      if (hasWorkoutTracking && (healthState.workouts.length > 0 || stravaConnected) && challenge.$id) {
        try {
          console.log("🏋️ syncHealthData: Delegating to resyncHealthDataForDate for workout sync");
          await get().resyncHealthDataForDate(new Date(), todayLog.$id, () => {}, options);
          return; // resyncHealthDataForDate handled everything
        } catch (error) {
          console.error("Failed to resync workout data:", error);
          // Fall through to regular sync if resync fails
        }
      }

      if (!healthState.isAuthorized) {
        // Nothing below this point has a source without Apple Health.
        return;
      }

      const updates: Partial<DailyLog> = {};

      // Sync steps - always pull from Apple Health for display, fetching fresh data directly
      try {
        const { healthService } = await import("@/lib/health");
        const stepsCount = await healthService.getStepsForDate(new Date());
        if (stepsCount > 0) {
          const newStepsCount = Math.round(stepsCount);
          const stepsGoalMet = newStepsCount >= (challenge.stepsGoal || 0);

          // Only update if steps changed
          if (newStepsCount !== todayLog.stepsCount) {
            updates.stepsCount = newStepsCount;
            // Only mark as completed if we're tracking steps
            if (challenge.trackSteps) {
              updates.stepsCompleted = stepsGoalMet;
            }

            // Keep today's "steps" activity log entry up to date so the
            // Activity tab reflects auto-synced steps, not just manual resyncs.
            try {
              const todayStr = getTodayDateString();
              const existingStepsLogs = await getActivityLogsForDate(challenge.$id!, todayStr, "steps");
              const description = `${newStepsCount.toLocaleString()} steps from Apple Health${challenge.trackSteps ? "" : " (display only)"}`;
              if (existingStepsLogs.length > 0) {
                await updateActivityLog(existingStepsLogs[0].$id!, { value: newStepsCount, description });
              } else {
                await createActivityLog({
                  userId: challenge.userId,
                  challengeId: challenge.$id!,
                  type: "steps",
                  title: challenge.trackSteps ? "Steps" : "Steps (Auto-sync)",
                  description,
                  value: newStepsCount,
                  unit: "steps",
                  date: todayStr,
                });
              }
              await get().fetchActivityLogs(challenge.$id!);
            } catch (activityError) {
              console.log("Steps activity log sync skipped:", activityError);
            }
          }
        }
      } catch (error) {
        console.log("Steps sync skipped:", error);
      }

      // Sync water if tracking is enabled
      if (challenge.trackWater) {
        try {
          const { healthSyncService } = await import("@/lib/healthSync");
          const waterLiters = await healthSyncService.getWaterIntakeForDate(new Date());
          if (waterLiters && waterLiters > 0) {
            const waterGoalMet = waterLiters >= (challenge.waterLiters || 0);
            if (waterLiters !== todayLog.waterLiters) {
              updates.waterLiters = waterLiters;
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
          if (sleepData && sleepData.asleepMinutes > 0) {
            const sleepGoalMinutes = ((challenge as any).sleepGoalHours || 8) * 60;
            const sleepGoalMet = sleepData.asleepMinutes >= sleepGoalMinutes;
            if (sleepData.asleepMinutes !== todayLog.sleepMinutes) {
              updates.sleepMinutes = sleepData.asleepMinutes;
              updates.sleepLogged = true;
              updates.sleepCompleted = sleepGoalMet;
              // Also sync the times if available
              if (sleepData.startTime && sleepData.endTime) {
                updates.sleepStartTime = sleepData.startTime.toISOString();
                updates.sleepEndTime = sleepData.endTime.toISOString();
              }
            }
          }
        } catch (error) {
          console.log("Sleep sync skipped:", error);
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        console.log("syncHealthData: Updating daily log with:", updates);
        
        // Update local state optimistically
        set({ todayLog: { ...todayLog, ...updates } });

        // Persist
        const updated = await updateDailyLog(todayLog.$id, updates);
        set({ todayLog: updated });
        
        console.log("syncHealthData: Successfully synced health data");
        
        // Note: Activity log creation for workouts is handled by resyncHealthData
        // to avoid duplicate logs. The background sync only updates the daily log metrics.
        
        // Check for notification triggers
        const notificationStore = useNotificationStore.getState();
        const today = new Date().toISOString().split("T")[0];
        
        // Check if step goal was just achieved
        if (updates.stepsCompleted && !todayLog.stepsCompleted) {
          const wasNotified = notificationStore.hasNotifiedStepGoal(today);
          if (!wasNotified) {
            notificationStore.markStepGoalNotified(today);
            await NotificationService.notifyStepGoalReached(updates.stepsCount ?? challenge.stepsGoal);
            // Add to in-app notification tray
            notificationStore.addNotification({
              type: "step_goal",
              title: "👣 Step Goal Reached!",
              body: `You hit ${(updates.stepsCount ?? challenge.stepsGoal).toLocaleString()} steps today!`,
              icon: "trending-up",
              color: "#3B82F6",
            });
          }
        }
        
        // Check if workout was just completed
        if (updates.workout1Completed && !todayLog.workout1Completed) {
          const wasNotified = notificationStore.hasNotifiedWorkout(today, "workout1");
          if (!wasNotified) {
            notificationStore.markWorkoutNotified(today, "workout1");
            await NotificationService.notifyWorkoutDetected(updates.workout1Minutes ?? 0, "Workout 1");
            // Add to in-app notification tray
            notificationStore.addNotification({
              type: "workout_complete",
              title: "💪 Workout 1 Complete!",
              body: `${updates.workout1Minutes ?? 0} minutes logged from Apple Health`,
              icon: "activity",
              color: "#F97316",
            });
          }
        }
        
        if (updates.workout2Completed && !todayLog.workout2Completed) {
          const wasNotified = notificationStore.hasNotifiedWorkout(today, "workout2");
          if (!wasNotified) {
            notificationStore.markWorkoutNotified(today, "workout2");
            await NotificationService.notifyWorkoutDetected(updates.workout2Minutes ?? 0, "Workout 2");
            // Add to in-app notification tray
            notificationStore.addNotification({
              type: "workout_complete",
              title: "💪 Workout 2 Complete!",
              body: `${updates.workout2Minutes ?? 0} minutes logged from Apple Health`,
              icon: "activity",
              color: "#8B5CF6",
            });
          }
        }
        
        // Check if day is now complete
        if (isDayComplete(challenge, updated)) {
          const wasNotified = notificationStore.hasNotifiedDayComplete(today);
          if (!wasNotified) {
            notificationStore.markDayCompleteNotified(today);
            await NotificationService.notifyDayComplete();
            // Add to in-app notification tray
            notificationStore.addNotification({
              type: "day_complete",
              title: "✅ Day Complete!",
              body: "Amazing work! You completed all your tasks today!",
              icon: "check-circle",
              color: "#10B981",
            });
          }
        }
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
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days - 1)); // -1 because we include today
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];
    
    // Check if any log from the last X days has a photo
    return allLogs.some(log => 
      log.date >= cutoffDateStr && (log.progressPhotoCompleted ?? false)
    );
  },

  deleteActivityLogById: async (logId: string) => {
    try {
      await deleteActivityLog(logId);
      // Remove from local state
      set((state) => ({
        activityLogs: state.activityLogs.filter((log) => log.$id !== logId),
      }));
      logger.info("Activity log deleted", { logId });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete activity log";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      throw err;
    }
  },

  clearChallenge: () => {
    set({ challenge: null, todayLog: null, allLogs: [], activityLogs: [], todayWorkouts: null, error: null });
  },
}));

/**
 * Fired once, the moment fetchTodayLog notices a new day's log needs
 * creating. Background HealthKit delivery for steps is sparse (see
 * useHealthStore.enableHealthBackgroundSync), so whatever count landed last
 * during the previous day would otherwise sit frozen as its permanent
 * historical record. Guarded by AsyncStorage so it only runs once per
 * calendar day even though fetchTodayLog can be called many times a day.
 */
async function finalizePreviousDayHealthDataIfNeeded(challengeId: string) {
  try {
    const yesterday = subDays(new Date(), 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");

    const lastFinalized = await AsyncStorage.getItem(LAST_HEALTH_FINALIZE_DATE_KEY);
    if (lastFinalized === yesterdayStr) return;

    const log = await getDailyLog(challengeId, yesterdayStr);
    if (log?.$id) {
      await useChallengeStore.getState().resyncHealthDataForDate(yesterday, log.$id);
    }

    await AsyncStorage.setItem(LAST_HEALTH_FINALIZE_DATE_KEY, yesterdayStr);
  } catch (err) {
    captureException(err instanceof Error ? err : new Error("Failed to finalize previous day's health data"));
  }
}
