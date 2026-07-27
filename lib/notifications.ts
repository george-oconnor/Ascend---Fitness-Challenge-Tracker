import { BADGES } from "@/constants/badges";
import type { BadgeId, Challenge, DailyLog } from "@/types/type";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Registers for remote push (requesting permission if needed) and returns an
 * Expo push token, or null if permission was denied or this isn't a real device.
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    console.error("Failed to get Expo push token:", error);
    return null;
  }
}

// Helper to check if notifications are enabled
// This will be checked by the store before calling these methods
let notificationsEnabledCheck: (() => boolean) | null = null;

export function setNotificationsEnabledCheck(check: () => boolean) {
  notificationsEnabledCheck = check;
}

function areNotificationsEnabled(): boolean {
  return notificationsEnabledCheck ? notificationsEnabledCheck() : true;
}

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationType =
  | "reminder"
  | "task_complete"
  | "day_complete"
  | "badge_earned"
  | "steps_goal"
  | "steps_milestone"
  | "workout_detected"
  | "water_goal"
  | "sleep_goal"
  | "weight_logged";

interface NotificationData {
  type: NotificationType;
  badgeId?: BadgeId;
  taskType?: string;
  [key: string]: any;
}

export class NotificationService {
  private static isInitialized = false;

  /**
   * Initialize notifications and request permissions
   */
  static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Notification permissions not granted");
        return false;
      }

      // Configure notification channels for Android
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#8B5CF6",
        });

        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });

        await Notifications.setNotificationChannelAsync("achievements", {
          name: "Achievements",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
        });
      }

      this.isInitialized = true;
      console.log("✅ Notifications initialized");
      return true;
    } catch (error) {
      console.error("Failed to initialize notifications:", error);
      return false;
    }
  }

  /**
   * Schedule a reminder notification for incomplete tasks
   */
  static async scheduleReminder(
    title: string,
    body: string,
    triggerHour: number = 19, // Default 7 PM
    taskType?: string
  ): Promise<string | null> {
    try {
      // Check if notifications are enabled
      if (!areNotificationsEnabled()) {
        return null;
      }
      
      const trigger = new Date();
      trigger.setHours(triggerHour, 0, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (trigger <= new Date()) {
        trigger.setDate(trigger.getDate() + 1);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "reminder", taskType } as NotificationData,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });

      return id;
    } catch (error) {
      console.error("Failed to schedule reminder:", error);
      return null;
    }
  }

  /**
   * Schedule daily reminder notifications based on challenge settings
   */
  static async scheduleDailyReminders(challenge: Challenge): Promise<void> {
    // Cancel existing reminders first
    await this.cancelAllScheduledReminders();

    const reminders: { title: string; body: string; hour: number }[] = [];

    // Morning motivation (8 AM)
    reminders.push({
      title: "🌅 Good Morning!",
      body: "Start your day strong - time to tackle your daily tasks!",
      hour: 8,
    });

    // Midday check-in (12 PM)
    reminders.push({
      title: "☀️ Midday Check-in",
      body: "How's your progress? Don't forget to log your water and meals!",
      hour: 12,
    });

    // Evening reminder (7 PM)
    reminders.push({
      title: "🌙 Evening Reminder",
      body: "Have you completed all your tasks today? Time to check in!",
      hour: 19,
    });

    // Reading reminder (9 PM)
    if (challenge.trackReading) {
      reminders.push({
        title: "📚 Reading Time",
        body: `Wind down with your ${challenge.readingPages || 10} pages of reading`,
        hour: 21,
      });
    }

    for (const reminder of reminders) {
      await this.scheduleReminder(reminder.title, reminder.body, reminder.hour);
    }
  }

  /**
   * Cancel all scheduled reminder notifications
   */
  static async cancelAllScheduledReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Send immediate notification for badge earned
   */
  static async notifyBadgeEarned(badgeId: BadgeId): Promise<void> {
    if (!areNotificationsEnabled()) return;
    
    const badge = BADGES[badgeId];
    if (!badge) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏆 Badge Earned!",
        body: `Congratulations! You earned "${badge.name}" - ${badge.description}`,
        data: { type: "badge_earned", badgeId } as NotificationData,
        sound: true,
      },
      trigger: null, // Immediate
    });
  }

  /**
   * Send notification when all daily tasks are complete
   */
  static async notifyDayComplete(dayNumber?: number): Promise<void> {
    if (!areNotificationsEnabled()) return;
    
    const messages = [
      "Amazing work! You crushed it today! 💪",
      "Another day down! You're unstoppable! 🔥",
      "Perfect day! Keep that momentum going! ⚡",
      "You did it! Tomorrow, we go again! 🚀",
      "All tasks complete! You're building something great! 🌟",
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const title = dayNumber ? `✅ Day ${dayNumber} Complete!` : "✅ Day Complete!";

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: randomMessage,
        data: { type: "day_complete", dayNumber } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send notification when step goal is reached
   */
  static async notifyStepGoalReached(steps: number, goal?: number): Promise<void> {
    if (!areNotificationsEnabled()) return;
    
    const body = goal 
      ? `You hit ${steps.toLocaleString()} steps today! Goal: ${goal.toLocaleString()}`
      : `You hit ${steps.toLocaleString()} steps today! 🎉`;
      
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "👣 Step Goal Reached!",
        body,
        data: { type: "steps_goal", steps, goal } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send notification when a workout is detected from Apple Health
   */
  static async notifyWorkoutDetected(duration: number, workoutName?: string): Promise<void> {
    if (!areNotificationsEnabled()) return;
    
    const name = workoutName || "Workout";
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💪 Workout Logged!",
        body: `${name} (${duration} min) completed!`,
        data: { type: "workout_detected", workoutName: name, duration } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send an encouraging notification at a step-count milestone (not the full
   * goal — that's notifyStepGoalReached). Intended to fire at most a few
   * times a day as "remaining to goal" crosses round thresholds.
   */
  static async notifyStepsMilestone(remaining: number): Promise<void> {
    if (!areNotificationsEnabled()) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "👣 Almost there!",
        body: `${remaining.toLocaleString()} steps to go!`,
        data: { type: "steps_milestone", remaining } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send notification when today's water goal is reached
   */
  static async notifyWaterGoalReached(liters: number): Promise<void> {
    if (!areNotificationsEnabled()) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "💧 Water Goal Reached!",
        body: `You hit ${liters.toFixed(1)}L today!`,
        data: { type: "water_goal", liters } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send notification when today's sleep goal is reached
   */
  static async notifySleepGoalReached(minutes: number): Promise<void> {
    if (!areNotificationsEnabled()) return;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "😴 Sleep Goal Reached!",
        body: `You got ${hours}h ${mins}m of sleep last night!`,
        data: { type: "sleep_goal", minutes } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Send notification when a new weight entry is picked up from Apple Health
   */
  static async notifyWeightLogged(weightKg: number): Promise<void> {
    if (!areNotificationsEnabled()) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚖️ Weight Logged",
        body: `${weightKg.toFixed(1)}kg synced from Apple Health`,
        data: { type: "weight_logged", weightKg } as NotificationData,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Check incomplete tasks and send a reminder
   */
  static async sendIncompleteTasksReminder(
    todayLog: DailyLog | null,
    challenge: Challenge
  ): Promise<void> {
    if (!todayLog || !challenge) return;

    const incompleteTasks: string[] = [];

    if (challenge.trackWorkout1 && !todayLog.workout1Completed) {
      incompleteTasks.push("Workout 1");
    }
    if (challenge.trackWorkout2 && !todayLog.workout2Completed) {
      incompleteTasks.push("Workout 2");
    }
    if (challenge.trackWater && !todayLog.waterCompleted) {
      incompleteTasks.push("Water");
    }
    if (challenge.trackDiet && !todayLog.dietCompleted) {
      incompleteTasks.push("Diet");
    }
    if (challenge.trackReading && !todayLog.readingCompleted) {
      incompleteTasks.push("Reading");
    }
    if (challenge.trackProgressPhoto && !todayLog.progressPhotoCompleted) {
      incompleteTasks.push("Progress Photo");
    }

    if (incompleteTasks.length > 0) {
      const tasksText =
        incompleteTasks.length === 1
          ? incompleteTasks[0]
          : `${incompleteTasks.slice(0, -1).join(", ")} and ${incompleteTasks.slice(-1)}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📋 Tasks Remaining",
          body: `Don't forget to complete: ${tasksText}`,
          data: { type: "reminder", tasks: incompleteTasks } as NotificationData,
          sound: true,
        },
        trigger: null,
      });
    }
  }
}
