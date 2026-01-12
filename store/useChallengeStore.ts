import {
    createActivityLog,
    createChallenge,
    createDailyLog,
    getActivityLogsForChallenge,
    getChallenge,
    getDailyLog,
    getDailyLogsForChallenge,
    updateChallenge,
    updateDailyLog,
} from "@/lib/appwrite";
import { isDayComplete } from "@/lib/dayCompletion";
import { NotificationService } from "@/lib/notifications";
import { captureException, logger } from "@/lib/sentry";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { ActivityLog, ActivityType, Challenge, DailyLog } from "@/types/type";
import { format } from "date-fns";
import { Platform } from "react-native";
import { create } from "zustand";

type ChallengeState = {
  challenge: Challenge | null;
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  activityLogs: ActivityLog[];
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
  }) => Promise<void>;
  syncHealthData: () => Promise<void>;
  resyncHealthDataForDate: (date: Date, logId: string, logCallback?: (message: string) => void) => Promise<void>;
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
        date: getTodayDateString(),
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

  resyncHealthDataForDate: async (date: Date, logId: string, logCallback?: (message: string) => void) => {
    const { challenge } = get();
    const log = (msg: string) => {
      console.log(msg);
      logCallback?.(msg);
    };

    if (!challenge) {
      log("resyncHealthDataForDate: No challenge available");
      return;
    }

    // Only sync on iOS where Apple Health is available
    if (Platform.OS !== "ios") {
      log("⚠️ Resync only available on iOS");
      return;
    }

    try {
      const { healthService } = await import("@/lib/health");
      
      log(`📅 Fetching health data for ${format(date, 'MMM dd, yyyy')}...`);
      
      // Fetch workouts for the specific date
      const workouts = await healthService.getWorkoutsForDate(date);
      
      log(`🏋️ Found ${workouts.length} workout(s)`);
      if (workouts.length > 0) {
        workouts.forEach((w, idx) => {
          log(`  ${idx + 1}. ${w.activityName}: ${w.duration} min`);
        });
      }

      const updates: Partial<DailyLog> = {};
      const activityLogsToCreate: Array<Omit<ActivityLog, "$id">> = [];
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (challenge.trackWorkout1 || challenge.trackWorkout2) {
        const workoutGoalMinutes = challenge.workoutMinutes || 45;

        if (workouts.length > 0) {
          // Sort workouts by start time (earliest first)
          const sortedWorkouts = [...workouts].sort(
            (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );

          // Calculate total minutes
          const totalMinutes = sortedWorkouts.reduce((sum, w) => sum + w.duration, 0);

          if (challenge.trackWorkout1 && challenge.trackWorkout2) {
            // Tracking both - assign workouts chronologically to slots
            let workout1Minutes = 0;
            let workout2Minutes = 0;
            
            // Assign first workout(s) to workout1 until goal is met or exceeded
            for (const workout of sortedWorkouts) {
              if (workout1Minutes === 0 || (workout1Minutes < workoutGoalMinutes && workout2Minutes === 0)) {
                workout1Minutes += workout.duration;
              } else {
                workout2Minutes += workout.duration;
              }
            }
            
            // Round the minutes
            workout1Minutes = Math.round(workout1Minutes);
            workout2Minutes = Math.round(workout2Minutes);
            
            log(`💪 Workout 1: ${workout1Minutes} min ${workout1Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
            log(`💪 Workout 2: ${workout2Minutes} min ${workout2Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
            
            updates.workout1Minutes = workout1Minutes;
            updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
            updates.workout2Minutes = workout2Minutes;
            updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
            
            // Create activity logs
            if (workout1Minutes > 0) {
              activityLogsToCreate.push({
                userId: challenge.userId,
                challengeId: challenge.$id,
                type: 'workout',
                title: 'Workout 1 (Resync)',
                description: `Outdoor workout: ${workout1Minutes} minutes`,
                value: workout1Minutes,
                unit: 'min',
                date: dateStr,
              });
            }
            if (workout2Minutes > 0) {
              activityLogsToCreate.push({
                userId: challenge.userId,
                challengeId: challenge.$id,
                type: 'workout',
                title: 'Workout 2 (Resync)',
                description: `Indoor workout: ${workout2Minutes} minutes`,
                value: workout2Minutes,
                unit: 'min',
                date: dateStr,
              });
            }
          } else if (challenge.trackWorkout1) {
            // Only tracking workout1 - assign all workout time to workout1
            const workout1Minutes = Math.round(totalMinutes);
            
            log(`💪 Workout 1: ${workout1Minutes} min ${workout1Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
            
            updates.workout1Minutes = workout1Minutes;
            updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
            
            if (workout1Minutes > 0) {
              activityLogsToCreate.push({
                userId: challenge.userId,
                challengeId: challenge.$id,
                type: 'workout',
                title: 'Workout (Resync)',
                description: `Total workout time: ${workout1Minutes} minutes`,
                value: workout1Minutes,
                unit: 'min',
                date: dateStr,
              });
            }
          } else if (challenge.trackWorkout2) {
            // Only tracking workout2 - assign all workout time to workout2
            const workout2Minutes = Math.round(totalMinutes);
            
            log(`💪 Workout 2: ${workout2Minutes} min ${workout2Minutes >= workoutGoalMinutes ? '✅' : '❌'}`);
            
            updates.workout2Minutes = workout2Minutes;
            updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
            
            if (workout2Minutes > 0) {
              activityLogsToCreate.push({
                userId: challenge.userId,
                challengeId: challenge.$id,
                type: 'workout',
                title: 'Workout (Resync)',
                description: `Total workout time: ${workout2Minutes} minutes`,
                value: workout2Minutes,
                unit: 'min',
                date: dateStr,
              });
            }
          }
        } else {
          log("⚠️ No workouts found for this date");
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        log(`💾 Updating daily log...`);
        
        // Persist to Appwrite
        const updated = await updateDailyLog(logId, updates);
        
        // Update local state if this is today's log
        const { todayLog } = get();
        if (todayLog?.$id === logId) {
          set({ todayLog: updated });
        }
        
        // Refresh all logs to update the list
        const allLogs = await getUserDailyLogs(challenge.userId, challenge.$id);
        set({ allLogs });
        
        log(`✅ Daily log updated successfully`);
      } else {
        log("ℹ️ No changes needed");
      }
      
      // Create activity logs
      if (activityLogsToCreate.length > 0) {
        log(`📝 Creating ${activityLogsToCreate.length} activity log(s)...`);
        for (const activityLog of activityLogsToCreate) {
          await createActivityLog(activityLog);
        }
        log(`✅ Activity logs created`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to re-sync health data";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      log(`❌ Error: ${errorMsg}`);
      throw err;
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
      console.log("🏋️ syncHealthData: Checking workout sync", {
        trackWorkout1: challenge.trackWorkout1,
        trackWorkout2: challenge.trackWorkout2,
        workoutsCount: healthState.workouts.length,
        workouts: healthState.workouts.map(w => ({ name: w.activityName, duration: w.duration })),
      });
      
      if (challenge.trackWorkout1 || challenge.trackWorkout2) {
        const workouts = healthState.workouts;
        const workoutGoalMinutes = challenge.workoutMinutes || 45;

        if (workouts.length > 0) {
          // Sort workouts by start time (earliest first)
          const sortedWorkouts = [...workouts].sort(
            (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );

          // Calculate total minutes
          const totalMinutes = sortedWorkouts.reduce((sum, w) => sum + w.duration, 0);

          // Strategy: Assign complete workouts to slots, don't split individual workouts
          // If tracking both workouts, assign individual workouts to slots based on chronological order
          // If tracking only one workout, assign all workout time to that slot

          if (challenge.trackWorkout1 && challenge.trackWorkout2) {
            // Tracking both - assign workouts chronologically to slots
            let workout1Minutes = 0;
            let workout2Minutes = 0;
            
            // Assign first workout(s) to workout1 until goal is met or exceeded
            for (const workout of sortedWorkouts) {
              if (workout1Minutes === 0 || (workout1Minutes < workoutGoalMinutes && workout2Minutes === 0)) {
                workout1Minutes += workout.duration;
              } else {
                workout2Minutes += workout.duration;
              }
            }
            
            // Round the minutes
            workout1Minutes = Math.round(workout1Minutes);
            workout2Minutes = Math.round(workout2Minutes);
            
            console.log("🏋️ syncHealthData: Both workouts tracking", {
              totalMinutes,
              workout1Minutes,
              workout2Minutes,
              currentWorkout1Minutes: todayLog.workout1Minutes,
              currentWorkout2Minutes: todayLog.workout2Minutes,
            });
            
            if (workout1Minutes !== todayLog.workout1Minutes) {
              updates.workout1Minutes = workout1Minutes;
              updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
            }
            
            if (workout2Minutes !== todayLog.workout2Minutes) {
              updates.workout2Minutes = workout2Minutes;
              updates.workout2Completed = workout2Minutes >= workoutGoalMinutes;
            }
          } else if (challenge.trackWorkout1) {
            // Only tracking workout1 - assign all workout time to workout1
            const workout1Minutes = Math.round(totalMinutes);
            
            console.log("🏋️ syncHealthData: Workout1 only", {
              totalMinutes,
              workout1Minutes,
              currentWorkout1Minutes: todayLog.workout1Minutes,
            });
            
            if (workout1Minutes !== todayLog.workout1Minutes) {
              updates.workout1Minutes = workout1Minutes;
              updates.workout1Completed = workout1Minutes >= workoutGoalMinutes;
            }
          } else if (challenge.trackWorkout2) {
            // Only tracking workout2 - assign all workout time to workout2
            const workout2Minutes = Math.round(totalMinutes);
            
            console.log("🏋️ syncHealthData: Workout2 only", {
              totalMinutes,
              workout2Minutes,
              currentWorkout2Minutes: todayLog.workout2Minutes,
            });
            
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
    set({ challenge: null, todayLog: null, allLogs: [], activityLogs: [], error: null });
  },
}));
