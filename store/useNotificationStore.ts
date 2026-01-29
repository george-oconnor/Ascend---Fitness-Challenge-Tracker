import { NotificationService } from "@/lib/notifications";
import type { Badge, BadgeId } from "@/types/type";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// In-app notification type
export type InAppNotificationType = 
  | "badge_earned"
  | "day_complete"
  | "step_goal"
  | "workout_complete"
  | "streak"
  | "reminder"
  | "milestone";

export interface InAppNotification {
  id: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  icon: string;
  color: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, any>;
}

type NotificationState = {
  // In-app notification tray
  notifications: InAppNotification[];
  unreadCount: number;
  
  // Badge celebration
  celebratingBadge: Badge | null;
  badgeQueue: Badge[];
  
  // Notification state
  isInitialized: boolean;
  hasPermission: boolean;
  notificationsEnabled: boolean;
  
  // Recently notified (to prevent duplicates)
  notifiedStepGoals: Set<string>; // date strings
  notifiedWorkouts: Set<string>; // date+workout type
  notifiedDayComplete: Set<string>; // date strings
  notifiedBadges: Set<BadgeId>;
  
  // Actions
  initialize: () => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  showBadgeCelebration: (badge: Badge) => void;
  dismissBadgeCelebration: () => void;
  queueBadgeCelebration: (badge: Badge) => void;
  
  // In-app notification tray actions
  addNotification: (notification: Omit<InAppNotification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Notification tracking
  markStepGoalNotified: (date: string) => void;
  markWorkoutNotified: (date: string, workoutType: string) => void;
  markDayCompleteNotified: (date: string) => void;
  markBadgeNotified: (badgeId: BadgeId) => void;
  hasNotifiedStepGoal: (date: string) => boolean;
  hasNotifiedWorkout: (date: string, workoutType: string) => boolean;
  hasNotifiedDayComplete: (date: string) => boolean;
  hasNotifiedBadge: (badgeId: BadgeId) => boolean;
  
  // Clear for new day
  clearDailyNotifications: () => void;
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      celebratingBadge: null,
      badgeQueue: [],
      isInitialized: false,
      hasPermission: false,
      notificationsEnabled: true,
      notifiedStepGoals: new Set(),
      notifiedWorkouts: new Set(),
      notifiedDayComplete: new Set(),
      notifiedBadges: new Set(),

      initialize: async () => {
        const hasPermission = await NotificationService.initialize();
        set({ isInitialized: true, hasPermission });
      },

      setNotificationsEnabled: async (enabled: boolean) => {
        set({ notificationsEnabled: enabled });
        
        if (!enabled) {
          // Cancel all scheduled notifications when disabled
          await NotificationService.cancelAllScheduledReminders();
        }
      },

      addNotification: (notification) => {
        const newNotification: InAppNotification = {
          ...notification,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          read: false,
        };
        
        const { notifications } = get();
        // Keep only latest 50 notifications
        const updatedNotifications = [newNotification, ...notifications].slice(0, 50);
        const unreadCount = updatedNotifications.filter(n => !n.read).length;
        
        set({ notifications: updatedNotifications, unreadCount });
      },

      markAsRead: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        );
        const unreadCount = updatedNotifications.filter(n => !n.read).length;
        set({ notifications: updatedNotifications, unreadCount });
      },

      markAllAsRead: () => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
        set({ notifications: updatedNotifications, unreadCount: 0 });
      },

      clearNotification: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.filter(n => n.id !== id);
        const unreadCount = updatedNotifications.filter(n => !n.read).length;
        set({ notifications: updatedNotifications, unreadCount });
      },

      clearAllNotifications: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      showBadgeCelebration: (badge: Badge) => {
        const { celebratingBadge, badgeQueue } = get();
        
        // If already showing a badge, queue this one
        if (celebratingBadge) {
          set({ badgeQueue: [...badgeQueue, badge] });
        } else {
          set({ celebratingBadge: badge });
        }
      },

      dismissBadgeCelebration: () => {
        const { badgeQueue } = get();
        
        if (badgeQueue.length > 0) {
          // Show next badge in queue
          const [nextBadge, ...remainingQueue] = badgeQueue;
          set({ celebratingBadge: nextBadge, badgeQueue: remainingQueue });
        } else {
          set({ celebratingBadge: null });
        }
      },

      queueBadgeCelebration: (badge: Badge) => {
        const { badgeQueue, celebratingBadge, notifiedBadges, addNotification, notificationsEnabled } = get();
        
        // Don't queue if already notified
        if (notifiedBadges.has(badge.id)) return;
        
        // Mark as notified
        set({ notifiedBadges: new Set([...notifiedBadges, badge.id]) });
        
        // Send push notification only if enabled
        if (notificationsEnabled) {
          NotificationService.notifyBadgeEarned(badge.id);
        }
        
        // Add to in-app notification tray
        addNotification({
          type: "badge_earned",
          title: "🏆 Badge Earned!",
          body: `You earned "${badge.name}" - ${badge.description}`,
          icon: badge.icon,
          color: badge.color,
          data: { badgeId: badge.id },
        });
        
        // Queue for in-app celebration
        if (celebratingBadge) {
          set({ badgeQueue: [...badgeQueue, badge] });
        } else {
          set({ celebratingBadge: badge });
        }
      },

      markStepGoalNotified: (date: string) => {
        const { notifiedStepGoals } = get();
        set({ notifiedStepGoals: new Set([...notifiedStepGoals, date]) });
      },

      markWorkoutNotified: (date: string, workoutType: string) => {
        const { notifiedWorkouts } = get();
        const key = `${date}-${workoutType}`;
        set({ notifiedWorkouts: new Set([...notifiedWorkouts, key]) });
      },

      markDayCompleteNotified: (date: string) => {
        const { notifiedDayComplete } = get();
        set({ notifiedDayComplete: new Set([...notifiedDayComplete, date]) });
      },

      markBadgeNotified: (badgeId: BadgeId) => {
        const { notifiedBadges } = get();
        set({ notifiedBadges: new Set([...notifiedBadges, badgeId]) });
      },

      hasNotifiedStepGoal: (date: string) => {
        return get().notifiedStepGoals.has(date);
      },

      hasNotifiedWorkout: (date: string, workoutType: string) => {
        const key = `${date}-${workoutType}`;
        return get().notifiedWorkouts.has(key);
      },

      hasNotifiedDayComplete: (date: string) => {
        return get().notifiedDayComplete.has(date);
      },

      hasNotifiedBadge: (badgeId: BadgeId) => {
        return get().notifiedBadges.has(badgeId);
      },

      clearDailyNotifications: () => {
        set({
          notifiedStepGoals: new Set(),
          notifiedWorkouts: new Set(),
          notifiedDayComplete: new Set(),
          // Don't clear badge notifications - they persist
        });
      },
    }),
    {
      name: "notification-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        notificationsEnabled: state.notificationsEnabled,
        // Convert Sets to arrays for storage
        notifiedBadges: Array.from(state.notifiedBadges),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        // Convert arrays back to Sets
        notifiedBadges: new Set(persistedState?.notifiedBadges || []),
      }),
    }
  )
);
