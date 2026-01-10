import { useTodayCycleLog } from "@/hooks/useCycleLog";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

type ActivityType = "steps" | "workout1" | "workout2" | "water" | "diet" | "reading" | "photo" | "alcohol" | "weight" | "mood" | "calories" | "cycle" | "sleep";

type ActivityConfig = {
  label: string;
  shortLabel: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  lightBgColor: string;
};

const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  steps: {
    label: "Steps",
    shortLabel: "Steps",
    icon: "trending-up",
    color: "#3B82F6",
    lightBgColor: "#DBEAFE",
  },
  workout1: {
    label: "Workout 1",
    shortLabel: "W1",
    icon: "activity",
    color: "#F97316",
    lightBgColor: "#FFEDD5",
  },
  workout2: {
    label: "Workout 2",
    shortLabel: "W2",
    icon: "activity",
    color: "#8B5CF6",
    lightBgColor: "#EDE9FE",
  },
  water: {
    label: "Water",
    shortLabel: "Water",
    icon: "droplet",
    color: "#06B6D4",
    lightBgColor: "#CFFAFE",
  },
  diet: {
    label: "Diet",
    shortLabel: "Diet",
    icon: "edit-3",
    color: "#22C55E",
    lightBgColor: "#DCFCE7",
  },
  reading: {
    label: "Reading",
    shortLabel: "Read",
    icon: "book-open",
    color: "#A855F7",
    lightBgColor: "#F3E8FF",
  },
  photo: {
    label: "Photo",
    shortLabel: "Photo",
    icon: "camera",
    color: "#EC4899",
    lightBgColor: "#FCE7F3",
  },
  alcohol: {
    label: "No Alcohol",
    shortLabel: "Sober",
    icon: "slash",
    color: "#EF4444",
    lightBgColor: "#FEE2E2",
  },
  weight: {
    label: "Weight",
    shortLabel: "Weight",
    icon: "trending-down",
    color: "#6366F1",
    lightBgColor: "#E0E7FF",
  },
  mood: {
    label: "Mood",
    shortLabel: "Mood",
    icon: "smile",
    color: "#F59E0B",
    lightBgColor: "#FEF3C7",
  },
  calories: {
    label: "Calories",
    shortLabel: "Cal",
    icon: "pie-chart",
    color: "#10B981",
    lightBgColor: "#D1FAE5",
  },
  cycle: {
    label: "Cycle",
    shortLabel: "Cycle",
    icon: "heart",
    color: "#EC4899",
    lightBgColor: "#FCE7F3",
  },
  sleep: {
    label: "Sleep",
    shortLabel: "Sleep",
    icon: "moon",
    color: "#8B5CF6",
    lightBgColor: "#EDE9FE",
  },
};

// Circular progress component
function CircularProgress({ 
  percent, 
  size = 56, 
  strokeWidth = 5, 
  color,
  children 
}: { 
  percent: number; 
  size?: number; 
  strokeWidth?: number; 
  color: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center justify-center">
        {children}
      </View>
    </View>
  );
}

type Props = {
  type: ActivityType;
  compact?: boolean;
};

export default function ActivityProgressCard({ type, compact = false }: Props) {
  const { challenge, todayLog, isPhotoCompletedWithinDays } = useChallengeStore();
  const { steps: liveSteps, workouts: liveWorkouts, isAuthorized: healthAuthorized } = useHealthStore();
  const { hasLoggedToday: cycleLoggedToday } = useTodayCycleLog();

  if (!challenge || !todayLog) return null;

  const config = ACTIVITY_CONFIG[type];
  const useHealthKit = Platform.OS === "ios" && healthAuthorized;

  // Get current value, goal, and completion status based on type
  let current = 0;
  let goal = 0;
  let unit = "";
  let isCompleted = false;
  let isTracked = false;

  switch (type) {
    case "steps":
      isTracked = challenge.trackSteps;
      current = useHealthKit ? Math.round(liveSteps) : (todayLog.stepsCount ?? 0);
      goal = challenge.stepsGoal ?? 0;
      unit = "";
      isCompleted = current >= goal;
      break;
    case "workout1":
      isTracked = challenge.trackWorkout1;
      current = useHealthKit
        ? Math.round(liveWorkouts.filter(w => w.isOutdoor).reduce((sum, w) => sum + w.duration, 0))
        : (todayLog.workout1Minutes ?? 0);
      goal = challenge.workoutMinutes ?? 0;
      unit = "min";
      isCompleted = current >= goal;
      break;
    case "workout2":
      isTracked = challenge.trackWorkout2;
      current = useHealthKit
        ? Math.round(liveWorkouts.filter(w => !w.isOutdoor).reduce((sum, w) => sum + w.duration, 0))
        : (todayLog.workout2Minutes ?? 0);
      goal = challenge.workoutMinutes ?? 0;
      unit = "min";
      isCompleted = current >= goal;
      break;
    case "water":
      isTracked = challenge.trackWater;
      current = todayLog.waterLiters ?? 0;
      goal = challenge.waterLiters ?? 0;
      unit = "L";
      isCompleted = current >= goal;
      break;
    case "diet":
      isTracked = challenge.trackDiet;
      isCompleted = todayLog.dietCompleted ?? false;
      break;
    case "reading":
      isTracked = challenge.trackReading;
      current = todayLog.readingPages ?? 0;
      goal = challenge.readingPages ?? 0;
      unit = "pg";
      isCompleted = current >= goal || (todayLog.readingCompleted ?? false);
      break;
    case "photo":
      isTracked = challenge.trackProgressPhoto;
      // Check if a photo was taken in the last X days
      const photoDays = (challenge as any).progressPhotoDays ?? 1;
      isCompleted = isPhotoCompletedWithinDays(photoDays);
      break;
    case "alcohol":
      isTracked = challenge.trackNoAlcohol;
      isCompleted = todayLog.noAlcoholCompleted ?? false;
      break;
    case "weight":
      isTracked = challenge.trackWeight;
      isCompleted = todayLog.weightLogged ?? false;
      break;
    case "mood":
      isTracked = challenge.trackMood;
      isCompleted = (todayLog.moodScore ?? 0) > 0;
      break;
    case "calories":
      isTracked = challenge.trackCalories;
      current = todayLog.caloriesConsumed ?? 0;
      goal = challenge.caloriesGoal ?? 2000;
      unit = "cal";
      isCompleted = current > 0 && current <= goal;
      break;
    case "cycle":
      isTracked = (challenge as any).trackCycle ?? false;
      isCompleted = cycleLoggedToday;
      goal = 0; // No numeric goal for cycle
      break;
    case "sleep":
      isTracked = (challenge as any).trackSleep ?? false;
      isCompleted = todayLog.sleepLogged ?? false;
      const sleepMinutes = todayLog.sleepMinutes ?? 0;
      const sleepGoalHours = (challenge as any).sleepGoalHours ?? 8;
      current = Math.round((sleepMinutes / 60) * 10) / 10; // Convert to hours with 1 decimal
      goal = sleepGoalHours;
      unit = "h";
      break;
  }

  if (!isTracked) return null;

  // Check if this activity is health-tracked (auto-synced via Apple Health on iOS)
  // Match the daily log screen logic: mark as health-tracked if on iOS, regardless of authorization status
  // Note: workouts are still tappable for manual entry even when health-tracked
  const isHealthTracked = Platform.OS === "ios" && (type === "steps" || type === "workout1" || type === "workout2" || type === "water" || type === "calories" || type === "alcohol" || type === "mood" || type === "weight" || type === "sleep" || type === "cycle");
  const isNonTappable = Platform.OS === "ios" && type === "steps"; // Only steps is non-tappable

  const hasProgress = goal > 0;
  const percent = hasProgress ? Math.min(100, Math.round((current / goal) * 100)) : (isCompleted ? 100 : 0);

  // Get the appropriate route for this activity type
  const getRouteForType = (): string => {
    switch (type) {
      case "water":
        return "/log-water";
      case "reading":
        return "/log-reading";
      case "weight":
        return "/log-weight";
      case "diet":
        return "/log-diet";
      case "photo":
        return "/log-photo";
      case "workout1":
        return "/log-workout?workout=1";
      case "workout2":
        return "/log-workout?workout=2";
      case "mood":
        return "/log-mood";
      case "alcohol":
        return "/log-alcohol";
      case "calories":
        return "/log-calories";
      case "cycle":
        return "/log-cycle";
      case "sleep":
        return "/log-sleep";
      default:
        return "/daily-log";
    }
  };

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 10000) return `${(num / 1000).toFixed(1)}k`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  // Compact card (for 2-per-row layout)
  if (compact) {
    const cardContent = (
      <View className="items-center">
        {/* Health indicator */}
        {isHealthTracked && (
          <View className="absolute top-0 right-0 bg-purple-100 p-1 rounded-full">
            <Feather name="heart" size={10} color="#8B5CF6" />
          </View>
        )}
        
        {/* Circular progress with icon */}
        <CircularProgress percent={percent} size={64} strokeWidth={5} color={config.color}>
          {isCompleted ? (
            <Feather name="check" size={24} color="#22C55E" />
          ) : (
            <Feather name={config.icon} size={24} color={config.color} />
          )}
        </CircularProgress>
        
        {/* Label */}
        <Text className="text-sm font-semibold text-gray-800 mt-2">{config.label}</Text>
        
        {/* Progress text */}
        {hasProgress ? (
          <Text className="text-xs text-gray-500">
            {formatNumber(current)}{unit ? ` ${unit}` : ""} / {formatNumber(goal)}{unit ? ` ${unit}` : ""}
          </Text>
        ) : (
          <Text className="text-xs text-gray-500">
            {isCompleted ? "Done!" : "Tap to log"}
          </Text>
        )}
      </View>
    );

    if (isNonTappable) {
      return (
        <View className="bg-white rounded-2xl p-4 shadow-sm flex-1" style={{ minWidth: '45%' as any }}>
          {cardContent}
        </View>
      );
    }
    
    return (
      <Pressable
        onPress={() => router.push(getRouteForType() as any)}
        className="bg-white rounded-2xl p-4 shadow-sm flex-1"
        style={{ minWidth: '45%' as any }}
      >
        {cardContent}
      </Pressable>
    );
  }

  // Full-width card content
  const fullCardContent = (
    <View className="flex-row items-center">
      {/* Circular progress */}
      <CircularProgress percent={percent} size={56} strokeWidth={5} color={config.color}>
        {isCompleted ? (
          <Feather name="check" size={20} color="#22C55E" />
        ) : (
          <Feather name={config.icon} size={20} color={config.color} />
        )}
      </CircularProgress>

      {/* Content */}
      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-gray-900">{config.label}</Text>
            {isHealthTracked && (
              <View className="ml-2 bg-purple-100 px-2 py-0.5 rounded flex-row items-center">
                <Feather name="heart" size={10} color="#8B5CF6" />
                <Text className="text-xs text-purple-600 font-medium ml-1">Health</Text>
              </View>
            )}
          </View>
          {isCompleted && (
            <View className="flex-row items-center bg-green-100 px-2 py-0.5 rounded-full">
              <Feather name="check" size={12} color="#22C55E" />
              <Text className="text-xs font-medium text-green-600 ml-1">Done</Text>
            </View>
          )}
        </View>

        {hasProgress ? (
          <Text className="text-sm text-gray-500 mt-0.5">
            {formatNumber(current)}{unit ? ` ${unit}` : ""} / {formatNumber(goal)}{unit ? ` ${unit}` : ""} ({percent}%)
          </Text>
        ) : (
          <Text className="text-sm text-gray-500 mt-0.5">
            {isCompleted ? "Completed today" : "Tap to mark complete"}
          </Text>
        )}
      </View>
    </View>
  );

  if (isNonTappable) {
    return (
      <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
        {fullCardContent}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(getRouteForType() as any)}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
    >
      {fullCardContent}
    </Pressable>
  );
}
