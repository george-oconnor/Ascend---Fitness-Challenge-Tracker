import { useTodayCycleLog } from "@/hooks/useCycleLog";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ChallengeStatusCard() {
  const { challenge, todayLog, isLoading } = useChallengeStore();
  const { steps, workouts, isAuthorized: healthAuthorized } = useHealthStore();
  const { hasLoggedToday: cycleLoggedToday } = useTodayCycleLog();

  if (isLoading) {
    return (
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <Text className="text-gray-500">Loading challenge...</Text>
      </View>
    );
  }

  // No challenge set up yet
  if (!challenge) {
    return (
      <Pressable
        onPress={() => router.push("/challenge-setup")}
        className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 mb-4 shadow-sm bg-primary"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-white text-lg font-bold mb-1">
                Start Your 75 Hard Challenge
              </Text>
              <Feather name="target" size={18} color="white" style={{ marginLeft: 8 }} />
            </View>
            <Text className="text-white/80 text-sm">
              Set up your challenge parameters and start tracking your progress
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color="white" />
        </View>
      </Pressable>
    );
  }

  // Calculate progress
  const startDate = new Date(challenge.startDate);
  // Set time to start of day for accurate comparison
  startDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysPassed =
    Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const hasStarted = daysPassed >= 1;
  const currentDay = hasStarted ? Math.min(daysPassed, challenge.totalDays) : 0;
  const progressPercent = hasStarted ? (currentDay / challenge.totalDays) * 100 : 0;
  const daysUntilStart = hasStarted ? 0 : Math.abs(daysPassed - 1);

  // Calculate today's completed activities
  let completedToday = 0;
  let totalTracked = 0;

  if (hasStarted && todayLog) {
    // Steps
    if (challenge.trackSteps) {
      totalTracked++;
      const stepsCount = healthAuthorized ? steps : (todayLog.stepsCount ?? 0);
      if (stepsCount >= challenge.stepsGoal) completedToday++;
    }

    // Workout 1
    if (challenge.trackWorkout1) {
      totalTracked++;
      const outdoorMinutes = healthAuthorized
        ? workouts.filter(w => w.isOutdoor).reduce((sum, w) => sum + w.duration, 0)
        : (todayLog.workout1Minutes ?? 0);
      if (outdoorMinutes >= challenge.workoutMinutes) completedToday++;
    }

    // Workout 2
    if (challenge.trackWorkout2) {
      totalTracked++;
      const totalMinutes = healthAuthorized
        ? workouts.reduce((sum, w) => sum + w.duration, 0)
        : ((todayLog.workout1Minutes ?? 0) + (todayLog.workout2Minutes ?? 0));
      if (totalMinutes >= challenge.workoutMinutes * 2) completedToday++;
    }

    // Diet
    if (challenge.trackDiet) {
      totalTracked++;
      if (todayLog.dietCompleted) completedToday++;
    }

    // Water
    if (challenge.trackWater) {
      totalTracked++;
      if ((todayLog.waterLiters ?? 0) >= challenge.waterLiters) completedToday++;
    }

    // Reading
    if (challenge.trackReading) {
      totalTracked++;
      if ((todayLog.readingPages ?? 0) >= challenge.readingPages || todayLog.readingCompleted) completedToday++;
    }

    // Progress Photo
    if (challenge.trackProgressPhoto) {
      totalTracked++;
      if (todayLog.progressPhotoCompleted) completedToday++;
    }

    // No Alcohol
    if (challenge.trackNoAlcohol) {
      totalTracked++;
      if (todayLog.noAlcoholCompleted) completedToday++;
    }

    // Weight
    if (challenge.trackWeight) {
      totalTracked++;
      if (todayLog.weightLogged) completedToday++;
    }

    // Calories
    if (challenge.trackCalories) {
      totalTracked++;
      const calories = todayLog.caloriesConsumed ?? 0;
      const direction = (challenge as any).caloriesGoalDirection ?? "below";
      const meetsGoal = calories > 0 && (direction === "below" ? calories <= challenge.caloriesGoal : calories >= challenge.caloriesGoal);
      if (meetsGoal) completedToday++;
    }

    // Mood
    if ((challenge as any).trackMood) {
      totalTracked++;
      if ((todayLog.moodScore ?? 0) > 0) completedToday++;
    }

    // Sleep
    if ((challenge as any).trackSleep) {
      totalTracked++;
      if (todayLog.sleepLogged) completedToday++;
    }

    // Cycle
    if ((challenge as any).trackCycle) {
      totalTracked++;
      if (cycleLoggedToday) completedToday++;
    }
  }

  // Count tracked tasks for the "not started" state display
  const trackedTasksCount = [
    challenge.trackSteps,
    challenge.trackWater,
    challenge.trackDiet,
    challenge.trackWorkout1,
    challenge.trackWorkout2,
    challenge.trackReading,
    challenge.trackProgressPhoto,
    challenge.trackNoAlcohol,
    challenge.trackMood,
  ].filter(Boolean).length;

  // Challenge hasn't started yet
  if (!hasStarted) {
    return (
      <Pressable
        onPress={() => router.push("/challenge-setup?edit=true")}
        className="bg-white rounded-2xl p-6 mb-4 shadow-sm"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs text-gray-500 uppercase tracking-wide">
              Starts in {daysUntilStart} day{daysUntilStart !== 1 ? "s" : ""}
            </Text>
            <Text className="text-xl font-bold text-gray-900">{challenge.totalDays} Hard Challenge</Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              router.push("/challenge-setup?edit=true");
            }}
            className="p-2"
          >
            <Feather name="edit-2" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Countdown info */}
        <View className="bg-purple-50 rounded-xl p-4">
          <View className="flex-row items-center">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Feather name="calendar" size={24} color="white" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-gray-900">
                Starting {startDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </Text>
              <Text className="text-sm text-gray-500">
                {challenge.totalDays} day challenge • {trackedTasksCount} daily tasks
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-xs text-gray-400 text-center mt-3">
          Tap to edit challenge settings
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => router.push("/daily-log")}
      className="bg-white rounded-2xl p-6 mb-4 shadow-sm"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-xs text-gray-500 uppercase tracking-wide">{challenge.totalDays} Hard Challenge</Text>
          <Text className="text-xl font-bold text-gray-900">Day {currentDay} of {challenge.totalDays}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            router.push("/challenge-setup?edit=true");
          }}
          className="p-2"
        >
          <Feather name="edit-2" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View className="mb-2">
        <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-xs text-gray-500 mt-1 text-right">
          {Math.round(progressPercent)}% complete
        </Text>
      </View>

      {/* Today's activities */}
      <View className="flex-row items-center justify-between mt-3 bg-gray-50 rounded-xl p-3">
        <View className="flex-row items-center">
          <View className={`h-8 w-8 rounded-full items-center justify-center ${
            completedToday === totalTracked ? "bg-green-500" : "bg-purple-500"
          }`}>
            <Feather name={completedToday === totalTracked ? "check" : "clock"} size={16} color="white" />
          </View>
          <Text className="text-sm font-semibold text-gray-700 ml-2">Today's Activities</Text>
        </View>
        <Text className={`text-base font-bold ${
          completedToday === totalTracked ? "text-green-600" : "text-purple-600"
        }`}>
          {completedToday} / {totalTracked}
        </Text>
      </View>
    </Pressable>
  );
}
