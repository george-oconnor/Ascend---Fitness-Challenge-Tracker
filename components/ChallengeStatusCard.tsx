import { useTodayCycleLog } from "@/hooks/useCycleLog";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

// Celebration sparkle component
function CelebrationSparkles() {
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (value: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(sparkle1, 0);
    animate(sparkle2, 200);
    animate(sparkle3, 400);
  }, []);

  const sparkleStyle = (anim: Animated.Value, left: number, top: number) => ({
    position: 'absolute' as const,
    left,
    top,
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
  });

  return (
    <>
      <Animated.View style={sparkleStyle(sparkle1, -8, -8)}>
        <Text style={{ fontSize: 16 }}>✨</Text>
      </Animated.View>
      <Animated.View style={sparkleStyle(sparkle2, 50, -12)}>
        <Text style={{ fontSize: 14 }}>⭐</Text>
      </Animated.View>
      <Animated.View style={sparkleStyle(sparkle3, 100, -6)}>
        <Text style={{ fontSize: 12 }}>✨</Text>
      </Animated.View>
    </>
  );
}

export default function ChallengeStatusCard() {
  const { challenge, todayLog, isLoading } = useChallengeStore();
  const { steps, workouts, isAuthorized: healthAuthorized } = useHealthStore();
  const { hasLoggedToday: cycleLoggedToday } = useTodayCycleLog();
  
  // Press animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

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
                Start Your Challenge
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
      const workout1Minutes = todayLog.workout1Minutes ?? 0;
      if (workout1Minutes >= challenge.workoutMinutes) completedToday++;
    }

    // Workout 2
    if (challenge.trackWorkout2) {
      totalTracked++;
      const workout2Minutes = todayLog.workout2Minutes ?? 0;
      if (workout2Minutes >= challenge.workoutMinutes) completedToday++;
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
      const sleepGoalMinutes = ((challenge as any).sleepGoalHours ?? 8) * 60;
      const sleepMet = todayLog.sleepCompleted === true || (todayLog.sleepMinutes ?? 0) >= sleepGoalMinutes;
      if (sleepMet) completedToday++;
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

  const isComplete = completedToday === totalTracked;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={() => router.push("/daily-log")}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="rounded-2xl p-6 mb-4 bg-white"
        style={{ 
          borderWidth: 1,
          borderColor: isComplete ? '#BBF7D0' : '#E5E7EB',
        }}
      >
        {/* Celebration sparkles when complete */}
        {isComplete && <CelebrationSparkles />}
        
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs uppercase tracking-wide text-gray-500">{challenge.totalDays} Hard Challenge</Text>
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

        {/* Progress bar - gradient effect */}
        <View className="mb-2">
          <View className="h-3 rounded-full overflow-hidden bg-gray-100">
            <View
              className="h-full rounded-full"
              style={{ 
                width: `${progressPercent}%`, 
                backgroundColor: isComplete ? '#22C55E' : '#3B82F6',
              }}
            />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-500">
              {currentDay} days completed
            </Text>
            <Text className="text-xs" style={{ color: isComplete ? '#16A34A' : '#3B82F6' }}>
              {Math.round(progressPercent)}%
            </Text>
          </View>
        </View>

        {/* Today's activities */}
        <View 
          className="flex-row items-center justify-between mt-3 rounded-xl p-3" 
          style={{ backgroundColor: isComplete ? '#DCFCE7' : '#F3F4F6' }}
        >
          <View className="flex-row items-center">
            <View 
              className="h-8 w-8 rounded-full items-center justify-center"
              style={{ backgroundColor: isComplete ? '#22C55E' : '#3B82F6' }}
            >
              <Feather 
                name={isComplete ? "check" : "clock"} 
                size={16} 
                color="white" 
              />
            </View>
            <View className="ml-2">
              <Text className="text-sm font-semibold" style={{ color: isComplete ? '#15803D' : '#374151' }}>
                {isComplete ? "All Done! 🎉" : "Today's Progress"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <Text className="text-lg font-bold" style={{ color: isComplete ? '#16A34A' : '#3B82F6' }}>
              {completedToday}
            </Text>
            <Text className="text-sm text-gray-400 mx-1">/</Text>
            <Text className="text-sm text-gray-500">{totalTracked}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
