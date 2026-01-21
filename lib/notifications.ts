import { BADGES } from "@/constants/badges";
import type { BadgeId, Challenge, DailyLog } from "@/types/type";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
  | "workout_detected";

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
