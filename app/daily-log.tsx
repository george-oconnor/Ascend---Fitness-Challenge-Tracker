import { getCycleLog } from "@/lib/cycleHealth";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { DailyLog } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TaskItem = {
  key: keyof DailyLog;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  isHealthTracked?: boolean; // True for tasks that sync from Apple Health on iOS
  route?: string; // Route to navigate to when tapped
  healthData?: {
    current: number;
    goal: number;
    unit: string;
    autoComplete?: boolean;
    color?: string; // Progress bar color when incomplete
  };
};

export default function DailyLogScreen() {
  const [connectingHealth, setConnectingHealth] = useState(false);
  const [cycleLoggedToday, setCycleLoggedToday] = useState(false);
  const lastSyncedRef = useRef<{ steps: number; outdoorMinutes: number; totalMinutes: number } | null>(null);
  const { challenge, todayLog, toggleTask, updateProgress } = useChallengeStore();
  const { 
    steps, 
    workouts, 
    isAuthorized,
    isNativeModuleAvailable,
    error: healthError,
    isLoading: healthLoading,
    initialize: initHealth,
    fetchTodayData,
    getOutdoorWorkoutMinutes,
    getTotalWorkoutMinutes,
  } = useHealthStore();

  // Check if cycle was logged today
  useEffect(() => {
    const checkCycleLog = async () => {
      if ((challenge as any)?.trackCycle && todayLog) {
        try {
          const { user } = useSessionStore.getState();
          if (user?.id) {
            const today = new Date().toISOString().split("T")[0];
            const cycleLog = await getCycleLog(user.id, today);
            setCycleLoggedToday(!!cycleLog);
          }
        } catch (error) {
          console.log("Failed to check cycle log:", error);
        }
      }
    };
    checkCycleLog();
  }, [challenge, todayLog]);

  // Initialize health and fetch data (only if native module is available)
  useEffect(() => {
    if (Platform.OS === "ios" && isNativeModuleAvailable) {
      initHealth();
    }
  }, [isNativeModuleAvailable]);

  // Refresh health data periodically
  useEffect(() => {
    if (isAuthorized) {
      const interval = setInterval(() => {
        fetchTodayData();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  // Sync health data to daily log when it changes
  useEffect(() => {
    if (isAuthorized && todayLog && challenge && getOutdoorWorkoutMinutes && getTotalWorkoutMinutes) {
      const outdoorMinutes = getOutdoorWorkoutMinutes();
      const totalMinutes = getTotalWorkoutMinutes();

      // Check if values have actually changed since last sync
      if (lastSyncedRef.current &&
          lastSyncedRef.current.steps === steps &&
          lastSyncedRef.current.outdoorMinutes === outdoorMinutes &&
          lastSyncedRef.current.totalMinutes === totalMinutes) {
        return; // No changes, skip update
      }

      const progressUpdate: Partial<DailyLog> = {};

      // Update steps
      if (challenge.trackSteps && steps !== todayLog.stepsCount) {
        progressUpdate.stepsCount = steps;
        progressUpdate.stepsCompleted = steps >= challenge.stepsGoal;
      }

      // Update workout 1 (outdoor)
      if (challenge.trackWorkout1 && outdoorMinutes !== todayLog.workout1Minutes) {
        progressUpdate.workout1Minutes = outdoorMinutes;
        progressUpdate.workout1Completed = outdoorMinutes >= challenge.workoutMinutes;
      }

      // Update workout 2 (total - outdoor)
      if (challenge.trackWorkout2) {
        const secondWorkoutMinutes = Math.max(0, totalMinutes - challenge.workoutMinutes);
        if (secondWorkoutMinutes !== todayLog.workout2Minutes) {
          progressUpdate.workout2Minutes = secondWorkoutMinutes;
          progressUpdate.workout2Completed = totalMinutes >= challenge.workoutMinutes * 2;
        }
      }

      // Only update if there are changes
      if (Object.keys(progressUpdate).length > 0) {
        // Update ref before calling updateProgress to prevent re-triggering
        lastSyncedRef.current = { steps, outdoorMinutes, totalMinutes };
        updateProgress(progressUpdate);
      } else {
        // Still update ref even if no progress update to prevent checking again
        lastSyncedRef.current = { steps, outdoorMinutes, totalMinutes };
      }
    }
  }, [steps, isAuthorized, todayLog?.$id, challenge?.$id, getOutdoorWorkoutMinutes, getTotalWorkoutMinutes, updateProgress]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">No active challenge</Text>
        <Pressable
          onPress={() => router.replace("/challenge-setup")}
          className="mt-4 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Set Up Challenge</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Calculate current day
  const startDate = new Date(challenge.startDate);
  startDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysPassed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(Math.max(daysPassed, 1), challenge.totalDays);

  // Build task list based on challenge settings
  const tasks: TaskItem[] = [];

  if (challenge.trackWorkout1) {
    const currentMinutes = todayLog.workout1Minutes ?? 0;
    const meetsGoal = currentMinutes >= challenge.workoutMinutes;
    tasks.push({
      key: "workout1Completed",
      label: "Workout 1",
      description: `${challenge.workoutMinutes}+ minutes exercise`,
      icon: "sun",
      route: "/log-workout?workout=1",
      isHealthTracked: Platform.OS === "ios",
      healthData: isAuthorized ? {
        current: currentMinutes,
        goal: challenge.workoutMinutes,
        unit: "min",
        autoComplete: meetsGoal,
        color: "#F97316", // Orange for workout 1
      } : undefined,
    });
  }
  
  if (challenge.trackWorkout2) {
    // Workout 2
    const currentMinutes = todayLog.workout2Minutes ?? 0;
    const meetsGoal = currentMinutes >= challenge.workoutMinutes;
    tasks.push({
      key: "workout2Completed",
      label: "Workout 2",
      description: `${challenge.workoutMinutes}+ minutes exercise`,
      icon: "activity",
      route: "/log-workout?workout=2",
      isHealthTracked: Platform.OS === "ios",
      healthData: isAuthorized ? {
        current: currentMinutes,
        goal: challenge.workoutMinutes,
        unit: "min",
        autoComplete: meetsGoal,
        color: "#EF4444", // Red for workout 2
      } : undefined,
    });
  }

  if (challenge.trackDiet) {
    tasks.push({
      key: "dietCompleted",
      label: "Follow Diet",
      description: "Stuck to your diet plan today",
      icon: "check-square",
      route: "/log-diet",
    });
  }

  if (challenge.trackWater) {
    const waterGoal = challenge.waterLiters;
    const waterCurrent = todayLog.waterLiters ?? 0;
    const meetsGoal = waterCurrent >= waterGoal;
    tasks.push({
      key: "waterCompleted",
      label: "Drink Water",
      description: waterCurrent > 0 
        ? `${waterCurrent}L / ${waterGoal}L logged`
        : `Goal: ${waterGoal}L`,
      icon: "droplet",
      route: "/log-water",
      isHealthTracked: Platform.OS === "ios",
      healthData: waterCurrent > 0 ? {
        current: waterCurrent,
        goal: waterGoal,
        unit: "L",
        autoComplete: meetsGoal,
        color: "#06B6D4", // Cyan for water
      } : undefined,
    });
  }

  if (challenge.trackReading) {
    tasks.push({
      key: "readingCompleted",
      label: "Read",
      description: `Read ${challenge.readingPages}+ pages of non-fiction`,
      icon: "book-open",
      route: "/log-reading",
    });
  }

  if (challenge.trackProgressPhoto) {
    tasks.push({
      key: "progressPhotoCompleted",
      label: "Progress Photo",
      description: "Took today's progress photo",
      icon: "camera",
      route: "/log-photo",
    });
  }

  if (challenge.trackNoAlcohol) {
    tasks.push({
      key: "noAlcoholCompleted",
      label: "No Alcohol",
      description: "No alcohol consumed today",
      icon: "slash",
      route: "/log-alcohol",
    });
  }

  if (challenge.trackWeight) {
    tasks.push({
      key: "weightLogged",
      label: "Log Weight",
      description: todayLog.weightLogged ? `${todayLog.currentWeight} kg logged` : "Log today's weight",
      icon: "trending-down",
      route: "/log-weight",
      isHealthTracked: Platform.OS === "ios",
    });
  }

  if (challenge.trackCalories) {
    const direction = (challenge as any).caloriesGoalDirection ?? "below";
    const meetsGoal = direction === "below" 
      ? (todayLog.caloriesConsumed ?? 0) <= challenge.caloriesGoal && (todayLog.caloriesConsumed ?? 0) > 0
      : (todayLog.caloriesConsumed ?? 0) >= challenge.caloriesGoal;
    tasks.push({
      key: "caloriesConsumed" as keyof DailyLog,
      label: "Track Calories",
      description: direction === "below" 
        ? `Stay under ${challenge.caloriesGoal} kcal` 
        : `Eat at least ${challenge.caloriesGoal} kcal`,
      icon: "bar-chart-2",
      route: "/log-calories",
      isHealthTracked: Platform.OS === "ios",
      healthData: (todayLog.caloriesConsumed ?? 0) > 0 ? {
        current: todayLog.caloriesConsumed ?? 0,
        goal: challenge.caloriesGoal,
        unit: "kcal",
        autoComplete: meetsGoal,
      } : undefined,
    });
  }

  if ((challenge as any).trackMood) {
    tasks.push({
      key: "moodScore" as keyof DailyLog,
      label: "Track Mood",
      description: todayLog.moodScore ? `Mood: ${todayLog.moodScore}/5` : "Log how you're feeling",
      icon: "smile",
      route: "/log-mood",
      isHealthTracked: Platform.OS === "ios",
    });
  }

  if ((challenge as any).trackSleep) {
    const sleepGoalMinutes = ((challenge as any).sleepGoalHours ?? 8) * 60;
    const meetsGoal = (todayLog.sleepMinutes ?? 0) >= sleepGoalMinutes;
    tasks.push({
      key: "sleepLogged",
      label: "Sleep Tracking",
      description: todayLog.sleepLogged 
        ? `${Math.floor((todayLog.sleepMinutes ?? 0) / 60)}h ${(todayLog.sleepMinutes ?? 0) % 60}m logged`
        : `Goal: ${(challenge as any).sleepGoalHours ?? 8}h`,
      icon: "moon",
      route: "/log-sleep",
      isHealthTracked: Platform.OS === "ios",
      healthData: todayLog.sleepLogged ? {
        current: Math.round((todayLog.sleepMinutes ?? 0) / 60 * 10) / 10,
        goal: (challenge as any).sleepGoalHours ?? 8,
        unit: "h",
        autoComplete: meetsGoal,
        color: "#A855F7", // Purple for sleep
      } : undefined,
    });
  }

  if ((challenge as any).trackCycle) {
    tasks.push({
      key: "cycleLogged" as keyof DailyLog,
      label: "Cycle Tracking",
      description: cycleLoggedToday ? "Logged today" : "Log cycle data",
      icon: "heart",
      route: "/log-cycle",
      isHealthTracked: Platform.OS === "ios",
    });
  }

  if (challenge.trackSkincare) {
    tasks.push({
      key: "skincareCompleted",
      label: "Skincare Routine",
      description: "Completed daily skincare",
      icon: "sun",
      route: "/log-skincare",
    });
  }

  if (challenge.trackSteps) {
    const meetsGoal = steps >= challenge.stepsGoal;
    tasks.push({
      key: "stepsCompleted",
      label: "Daily Steps",
      description: `Hit ${challenge.stepsGoal.toLocaleString()} steps`,
      icon: "trending-up",
      route: "/log-steps",
      isHealthTracked: Platform.OS === "ios",
      healthData: isAuthorized ? {
        current: steps,
        goal: challenge.stepsGoal,
        unit: "steps",
        autoComplete: meetsGoal,
      } : undefined,
    });
  }

  // Calculate completion - use health data auto-complete or manual toggle
  const getTaskCompleted = (task: TaskItem): boolean => {
    if (task.healthData?.autoComplete) {
      return true;
    }
    // Special cases for non-boolean fields
    if (task.key === "moodScore") {
      return (todayLog.moodScore ?? 0) > 0;
    }
    if (task.key === "caloriesConsumed") {
      const calories = todayLog.caloriesConsumed ?? 0;
      if (calories === 0) return false;
      const direction = (challenge as any).caloriesGoalDirection ?? "below";
      const goal = challenge.caloriesGoal;
      return direction === "below" ? calories <= goal : calories >= goal;
    }
    if (task.key === "cycleLogged") {
      // Check if cycle was logged today from separate collection
      return cycleLoggedToday;
    }
    if (task.key === "weightLogged") {
      return todayLog.weightLogged === true || (todayLog.currentWeight ?? 0) > 0;
    }
    if (task.key === "sleepLogged") {
      const sleepGoalMinutes = ((challenge as any).sleepGoalHours ?? 8) * 60;
      return todayLog.sleepCompleted === true || (todayLog.sleepMinutes ?? 0) >= sleepGoalMinutes;
    }
    return todayLog[task.key] as boolean;
  };

  const completedCount = tasks.filter((t) => getTaskCompleted(t)).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

  const handleTaskPress = (task: TaskItem) => {
    if (task.route) {
      router.push(task.route as any);
    }
  };

  const handleConnectHealth = async () => {
    try {
      setConnectingHealth(true);
      const ok = await initHealth();
      if (ok) {
        await fetchTodayData();
      }
    } finally {
      setConnectingHealth(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-blue-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 bg-blue-100 rounded-full">
          <Feather name="arrow-left" size={24} color="#3B82F6" />
        </Pressable>
        <View className="items-center">
          <Text className="text-xs text-blue-600">Day {currentDay} of {challenge.totalDays}</Text>
          <Text className="text-lg font-bold text-gray-900">Today's Log</Text>
        </View>
        <Pressable onPress={fetchTodayData} className="p-2 -mr-2 bg-blue-100 rounded-full">
          <Feather name="refresh-cw" size={20} color="#3B82F6" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Apple Health Card - Show different states */}
          {Platform.OS === "ios" && !isNativeModuleAvailable && (
            <View className="bg-yellow-50 rounded-2xl p-4 mb-4 border border-yellow-200">
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <Feather name="alert-circle" size={20} color="#CA8A04" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-yellow-800">Apple Health</Text>
                  <Text className="text-xs text-yellow-700">Requires TestFlight or development build</Text>
                </View>
              </View>
            </View>
          )}
          
          {Platform.OS === "ios" && isNativeModuleAvailable && !isAuthorized && (
            <Pressable
              onPress={handleConnectHealth}
              disabled={connectingHealth}
              className="bg-red-50 rounded-2xl p-4 mb-4 border border-red-100"
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Feather name="heart" size={20} color="#EF4444" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-900">Connect Apple Health</Text>
                  <Text className="text-xs text-gray-500">Auto-track steps & workouts</Text>
                  {healthError && (
                    <Text className="text-xs text-red-500 mt-1">{healthError}</Text>
                  )}
                </View>
                {connectingHealth ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                )}
              </View>
            </Pressable>
          )}

          {/* Status Banner */}
          <View
            className={`rounded-2xl p-4 mb-4 ${
              allComplete ? "bg-green-100" : "bg-orange-100"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`h-12 w-12 items-center justify-center rounded-full ${
                  allComplete ? "bg-green-500" : "bg-orange-500"
                }`}
              >
                <Feather
                  name={allComplete ? "check" : "clock"}
                  size={24}
                  color="white"
                />
              </View>
              <View className="ml-4">
                <Text
                  className={`text-lg font-bold ${
                    allComplete ? "text-green-800" : "text-orange-800"
                  }`}
                >
                  {allComplete ? "Day Complete!" : `${completedCount}/${tasks.length} Tasks Done`}
                </Text>
                <Text
                  className={`text-sm ${
                    allComplete ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  {allComplete
                    ? "You crushed it today!"
                    : `${tasks.length - completedCount} tasks remaining`}
                </Text>
              </View>
            </View>
          </View>

          {/* Task List */}
          <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {tasks.map((task, index) => {
              const isCompleted = getTaskCompleted(task);
              const hasHealthData = !!task.healthData;
              const isAutoCompleted = task.healthData?.autoComplete;
              const isHealthSynced = task.isHealthTracked === true;

              return (
                <Pressable
                  key={task.key}
                  onPress={() => handleTaskPress(task)}
                  className={`flex-row items-center p-4 ${
                    index < tasks.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isCompleted
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300"
                    }`}
                  >
                    {isCompleted && (
                      <Feather name="check" size={16} color="white" />
                    )}
                  </View>

                  {/* Icon */}
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-full ml-3 ${
                      isCompleted ? "bg-green-100" : "bg-gray-100"
                    }`}
                  >
                    <Feather
                      name={task.icon}
                      size={18}
                      color={isCompleted ? "#22C55E" : "#6B7280"}
                    />
                  </View>

                  {/* Content */}
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text
                        className={`text-base font-medium ${
                          isCompleted ? "text-green-700" : "text-gray-900"
                        }`}
                      >
                        {task.label}
                      </Text>
                      {isHealthSynced && (
                        <View className="ml-2 bg-purple-100 px-2 py-0.5 rounded flex-row items-center">
                          <Feather name="heart" size={10} color="#8B5CF6" />
                          <Text className="text-xs text-purple-600 font-medium ml-1">Health</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Health progress bar - show when authorized */}
                    {hasHealthData && task.healthData && (
                      <View className="mt-1">
                        <View className="flex-row items-center">
                          <View className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full"
                              style={{ 
                                width: `${Math.min(100, (task.healthData.current / task.healthData.goal) * 100)}%`,
                                backgroundColor: isCompleted ? "#22C55E" : (task.healthData.color || "#10B981")
                              }}
                            />
                          </View>
                          <Text className="text-xs text-gray-500 ml-2">
                            {task.healthData.current.toLocaleString()}/{task.healthData.goal.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Show connect prompt only for steps when not authorized */}
                    {isHealthSynced && !hasHealthData && task.key === "stepsCompleted" && (
                      <Text className="text-xs text-purple-500">
                        Connect Apple Health above to track
                      </Text>
                    )}
                    
                    {/* Show description for non-health tasks */}
                    {!hasHealthData && (
                      <Text
                        className={`text-xs ${
                          isCompleted ? "text-green-500" : "text-gray-500"
                        }`}
                      >
                        {task.description}
                      </Text>
                    )}
                  </View>

                  {/* Chevron icon for navigation */}
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </Pressable>
              );
            })}
          </View>

          {/* Workouts List */}
          {isAuthorized && workouts.length > 0 && (
            <View className="mt-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2 px-1">Today's Workouts</Text>
              <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {workouts.map((workout, index) => (
                  <View
                    key={workout.id}
                    className={`flex-row items-center p-4 ${
                      index < workouts.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <View className={`h-10 w-10 items-center justify-center rounded-full ${workout.isOutdoor ? "bg-orange-100" : "bg-blue-100"}`}>
                      <Feather
                        name={workout.isOutdoor ? "sun" : "home"}
                        size={18}
                        color={workout.isOutdoor ? "#F97316" : "#3B82F6"}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-gray-900">{workout.activityName}</Text>
                      <Text className="text-xs text-gray-500">
                        {workout.duration} min • {Math.round(workout.calories)} cal
                        {workout.distance ? ` • ${(workout.distance / 1000).toFixed(2)} km` : ""}
                      </Text>
                    </View>
                    <View className={`px-2 py-1 rounded ${workout.isOutdoor ? "bg-orange-100" : "bg-blue-100"}`}>
                      <Text className={`text-xs font-medium ${workout.isOutdoor ? "text-orange-600" : "text-blue-600"}`}>
                        {workout.isOutdoor ? "Outdoor" : "Indoor"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Encouragement */}
          {!allComplete && (
            <View className="mt-6 items-center">
              <Text className="text-gray-400 text-sm text-center">
                Tap any task to log your progress
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
