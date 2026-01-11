import type { Badge, BadgeId } from "@/types/type";

export const BADGES: Record<BadgeId, Badge> = {
  // Streak badges
  streak_3: {
    id: "streak_3",
    name: "Getting Started",
    description: "Complete a 3-day streak",
    icon: "zap",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  streak_7: {
    id: "streak_7",
    name: "One Week Strong",
    description: "Complete a 7-day streak",
    icon: "zap",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  streak_14: {
    id: "streak_14",
    name: "Two Week Warrior",
    description: "Complete a 14-day streak",
    icon: "zap",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },
  streak_30: {
    id: "streak_30",
    name: "Monthly Master",
    description: "Complete a 30-day streak",
    icon: "award",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },

  // Challenge progress badges
  day_1: {
    id: "day_1",
    name: "First Step",
    description: "Complete your first day",
    icon: "flag",
    color: "#10B981",
    bgColor: "#D1FAE5",
  },
  week_1: {
    id: "week_1",
    name: "Week One Done",
    description: "Complete your first week",
    icon: "calendar",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
  },
  day_25: {
    id: "day_25",
    name: "Quarter Way",
    description: "Complete 25 days",
    icon: "trending-up",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },
  day_50: {
    id: "day_50",
    name: "Halfway Hero",
    description: "Complete 50 days",
    icon: "star",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  day_75: {
    id: "day_75",
    name: "75 Hard Complete",
    description: "Complete 75 days",
    icon: "award",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },
  challenge_complete: {
    id: "challenge_complete",
    name: "Challenge Champion",
    description: "Complete your challenge",
    icon: "award",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
  },

  // Workout badges
  workout_10: {
    id: "workout_10",
    name: "Gym Rookie",
    description: "Log 10 workouts",
    icon: "activity",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  workout_25: {
    id: "workout_25",
    name: "Fitness Enthusiast",
    description: "Log 25 workouts",
    icon: "activity",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },
  workout_50: {
    id: "workout_50",
    name: "Workout Warrior",
    description: "Log 50 workouts",
    icon: "activity",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
  },
  workout_100: {
    id: "workout_100",
    name: "Iron Champion",
    description: "Log 100 workouts",
    icon: "award",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },

  // Reading badges
  pages_100: {
    id: "pages_100",
    name: "Bookworm",
    description: "Read 100 pages",
    icon: "book-open",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
  },
  pages_500: {
    id: "pages_500",
    name: "Avid Reader",
    description: "Read 500 pages",
    icon: "book-open",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },
  pages_1000: {
    id: "pages_1000",
    name: "Literary Legend",
    description: "Read 1000 pages",
    icon: "book-open",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },
  book_finished: {
    id: "book_finished",
    name: "Book Complete",
    description: "Finish a book",
    icon: "check-circle",
    color: "#10B981",
    bgColor: "#D1FAE5",
  },

  // Steps badges
  steps_10k: {
    id: "steps_10k",
    name: "10K Club",
    description: "Hit 10,000 steps in a day",
    icon: "navigation",
    color: "#10B981",
    bgColor: "#D1FAE5",
  },
  steps_15k: {
    id: "steps_15k",
    name: "15K Achiever",
    description: "Hit 15,000 steps in a day",
    icon: "navigation",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },
  steps_20k: {
    id: "steps_20k",
    name: "20K Legend",
    description: "Hit 20,000 steps in a day",
    icon: "navigation",
    color: "#EF4444",
    bgColor: "#FEE2E2",
  },

  // Water badges
  hydration_7: {
    id: "hydration_7",
    name: "Hydration Habit",
    description: "Meet water goal 7 days",
    icon: "droplet",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },
  hydration_30: {
    id: "hydration_30",
    name: "Hydration Hero",
    description: "Meet water goal 30 days",
    icon: "droplet",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
  },

  // Photo badges
  photo_7: {
    id: "photo_7",
    name: "Snapshot Streak",
    description: "Log progress photos 7 times",
    icon: "camera",
    color: "#EC4899",
    bgColor: "#FCE7F3",
  },
  photo_30: {
    id: "photo_30",
    name: "Photo Pro",
    description: "Log progress photos 30 times",
    icon: "camera",
    color: "#EC4899",
    bgColor: "#FCE7F3",
  },

  // Special badges
  early_bird: {
    id: "early_bird",
    name: "Early Bird",
    description: "Log activity before 6 AM",
    icon: "sunrise",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
  night_owl: {
    id: "night_owl",
    name: "Night Owl",
    description: "Log activity after 10 PM",
    icon: "moon",
    color: "#6366F1",
    bgColor: "#E0E7FF",
  },
  perfect_day: {
    id: "perfect_day",
    name: "Perfect Day",
    description: "Complete all tracked activities in one day",
    icon: "sun",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
  },
};

// Helper to get ordered badges for display
export const BADGE_CATEGORIES = {
  progress: ["day_1", "week_1", "day_25", "day_50", "day_75", "challenge_complete"] as BadgeId[],
  streaks: ["streak_3", "streak_7", "streak_14", "streak_30"] as BadgeId[],
  workouts: ["workout_10", "workout_25", "workout_50", "workout_100"] as BadgeId[],
  reading: ["pages_100", "pages_500", "pages_1000", "book_finished"] as BadgeId[],
  steps: ["steps_10k", "steps_15k", "steps_20k"] as BadgeId[],
  water: ["hydration_7", "hydration_30"] as BadgeId[],
  photos: ["photo_7", "photo_30"] as BadgeId[],
  special: ["early_bird", "night_owl", "perfect_day"] as BadgeId[],
};
