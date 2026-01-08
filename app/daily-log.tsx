import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import type { DailyLog } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TaskItem = {
  key: keyof DailyLog;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  healthData?: {
    current: number;
    goal: number;
    unit: string;
    autoComplete?: boolean;
  };
};

export default function DailyLogScreen() {
  const [connectingHealth, setConnectingHealth] = useState(false);
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
    if (isAuthorized && todayLog && challenge) {
      const outdoorMinutes = getOutdoorWorkoutMinutes();
      const totalMinutes = getTotalWorkoutMinutes();

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
        updateProgress(progressUpdate);
      }
    }
  }, [steps, workouts, isAuthorized, todayLog, challenge]);

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

  // Get workout minutes from Health
  const outdoorMinutes = getOutdoorWorkoutMinutes();
  const totalMinutes = getTotalWorkoutMinutes();

  // Build task list based on challenge settings
  const tasks: TaskItem[] = [];

  if (challenge.trackWorkout1) {
    const meetsGoal = outdoorMinutes >= challenge.workoutMinutes;
    tasks.push({
      key: "workout1Completed",
      label: "Outdoor Workout",
      description: `${challenge.workoutMinutes}+ minutes outdoor exercise`,
      icon: "sun",
      healthData: isAuthorized ? {
        current: outdoorMinutes,
        goal: challenge.workoutMinutes,
        unit: "min",
        autoComplete: meetsGoal,
      } : undefined,
    });
  }
  
  if (challenge.trackWorkout2) {
    // Second workout can be any workout (indoor or outdoor) but needs total of 2x goal
    const meetsGoal = totalMinutes >= challenge.workoutMinutes * 2;
    tasks.push({
      key: "workout2Completed",
      label: "Second Workout",
      description: `${challenge.workoutMinutes}+ minutes additional workout`,
      icon: "activity",
      healthData: isAuthorized ? {
        current: Math.max(0, totalMinutes - challenge.workoutMinutes),
        goal: challenge.workoutMinutes,
        unit: "min",
        autoComplete: meetsGoal,
      } : undefined,
    });
  }

  if (challenge.trackDiet) {
    tasks.push({
      key: "dietCompleted",
      label: "Follow Diet",
      description: "Stuck to your diet plan today",
      icon: "check-square",
    });
  }

  if (challenge.trackWater) {
    tasks.push({
      key: "waterCompleted",
      label: "Drink Water",
      description: `Drank ${challenge.waterLiters}L of water`,
      icon: "droplet",
    });
  }

  if (challenge.trackReading) {
    tasks.push({
      key: "readingCompleted",
      label: "Read",
      description: `Read ${challenge.readingPages}+ pages of non-fiction`,
      icon: "book-open",
    });
  }

  if (challenge.trackProgressPhoto) {
    tasks.push({
      key: "progressPhotoCompleted",
      label: "Progress Photo",
      description: "Took today's progress photo",
      icon: "camera",
    });
  }

  if (challenge.trackNoAlcohol) {
    tasks.push({
      key: "noAlcoholCompleted",
      label: "No Alcohol",
      description: "No alcohol consumed today",
      icon: "slash",
    });
  }

  if (challenge.trackSteps) {
    const meetsGoal = steps >= challenge.stepsGoal;
    tasks.push({
      key: "stepsCompleted",
      label: "Daily Steps",
      description: `Hit ${challenge.stepsGoal.toLocaleString()} steps`,
      icon: "trending-up",
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
    return todayLog[task.key] as boolean;
  };

  const completedCount = tasks.filter((t) => getTaskCompleted(t)).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

  const handleToggle = async (key: keyof DailyLog) => {
    const currentValue = todayLog[key] as boolean;
    try {
      await toggleTask(key, !currentValue);
    } catch (err) {
      // Error is handled in store
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <View className="items-center">
          <Text className="text-xs text-gray-500">Day {currentDay} of {challenge.totalDays}</Text>
          <Text className="text-lg font-bold text-gray-900">Today's Log</Text>
        </View>
        <Pressable onPress={fetchTodayData} className="p-2 -mr-2">
          <Feather name="refresh-cw" size={20} color="#6B7280" />
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

          {/* Health Stats Summary */}
          {isAuthorized && (
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <View className="flex-row items-center mb-3">
                <Feather name="heart" size={16} color="#EF4444" />
                <Text className="text-sm font-semibold text-gray-700 ml-2">Apple Health</Text>
                {healthLoading && <ActivityIndicator size="small" color="#8B5CF6" className="ml-2" />}
              </View>
              <View className="flex-row">
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-gray-900">{steps.toLocaleString()}</Text>
                  <Text className="text-xs text-gray-500">Steps</Text>
                </View>
                <View className="w-px bg-gray-200" />
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-gray-900">{totalMinutes}</Text>
                  <Text className="text-xs text-gray-500">Workout Mins</Text>
                </View>
                <View className="w-px bg-gray-200" />
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-gray-900">{workouts.length}</Text>
                  <Text className="text-xs text-gray-500">Workouts</Text>
                </View>
              </View>
            </View>
          )}

          {/* Status Banner */}
          <View
            className={`rounded-2xl p-4 mb-4 ${
              allComplete ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`h-12 w-12 items-center justify-center rounded-full ${
                  allComplete ? "bg-green-500" : "bg-gray-300"
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
                    allComplete ? "text-green-800" : "text-gray-700"
                  }`}
                >
                  {allComplete ? "Day Complete! 🎉" : `${completedCount}/${tasks.length} Tasks Done`}
                </Text>
                <Text
                  className={`text-sm ${
                    allComplete ? "text-green-600" : "text-gray-500"
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

              return (
                <Pressable
                  key={task.key}
                  onPress={() => !isAutoCompleted && handleToggle(task.key)}
                  className={`flex-row items-center p-4 ${
                    index < tasks.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isCompleted
                        ? isAutoCompleted
                          ? "bg-purple-500 border-purple-500"
                          : "bg-green-500 border-green-500"
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
                      isCompleted 
                        ? isAutoCompleted ? "bg-purple-100" : "bg-green-100" 
                        : "bg-gray-100"
                    }`}
                  >
                    <Feather
                      name={task.icon}
                      size={18}
                      color={isCompleted ? (isAutoCompleted ? "#8B5CF6" : "#22C55E") : "#6B7280"}
                    />
                  </View>

                  {/* Content */}
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text
                        className={`text-base font-medium ${
                          isCompleted 
                            ? isAutoCompleted ? "text-purple-700" : "text-green-700 line-through" 
                            : "text-gray-900"
                        }`}
                      >
                        {task.label}
                      </Text>
                      {isAutoCompleted && (
                        <View className="ml-2 bg-purple-100 px-2 py-0.5 rounded">
                          <Text className="text-xs text-purple-600 font-medium">Auto</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Health progress bar */}
                    {hasHealthData && task.healthData && (
                      <View className="mt-1">
                        <View className="flex-row items-center">
                          <View className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <View
                              className={`h-full rounded-full ${isAutoCompleted ? "bg-purple-500" : "bg-gray-400"}`}
                              style={{ 
                                width: `${Math.min(100, (task.healthData.current / task.healthData.goal) * 100)}%` 
                              }}
                            />
                          </View>
                          <Text className="text-xs text-gray-500 ml-2">
                            {task.healthData.current.toLocaleString()}/{task.healthData.goal.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    )}
                    
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
                {isAuthorized 
                  ? "Steps & workouts sync automatically from Apple Health 💪"
                  : "Tap a task to mark it complete. You've got this! 💪"
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
