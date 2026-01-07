import { useChallengeStore } from "@/store/useChallengeStore";
import type { DailyLog } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TaskItem = {
  key: keyof DailyLog;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
};

export default function DailyLogScreen() {
  const { challenge, todayLog, toggleTask } = useChallengeStore();

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
  const today = new Date();
  const daysPassed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(Math.max(daysPassed, 1), challenge.totalDays);

  // Build task list based on challenge settings
  const tasks: TaskItem[] = [];

  if (challenge.trackWorkout1) {
    tasks.push({
      key: "workout1Completed",
      label: "Outdoor Workout",
      description: `${challenge.workoutMinutes}+ minutes outdoor exercise`,
      icon: "sun",
    });
  }
  if (challenge.trackWorkout2) {
    tasks.push({
      key: "workout2Completed",
      label: "Second Workout",
      description: `${challenge.workoutMinutes}+ minutes additional workout`,
      icon: "activity",
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
    tasks.push({
      key: "stepsCompleted",
      label: "Daily Steps",
      description: `Hit ${challenge.stepsGoal.toLocaleString()} steps`,
      icon: "trending-up",
    });
  }

  const completedCount = tasks.filter((t) => todayLog[t.key]).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;

  const handleToggle = async (key: keyof DailyLog) => {
    const currentValue = todayLog[key] as boolean;
    try {
      await toggleTask(key, !currentValue);
    } catch (err) {
      // Error is handled in store
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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
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
              const isCompleted = todayLog[task.key] as boolean;

              return (
                <Pressable
                  key={task.key}
                  onPress={() => handleToggle(task.key)}
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
                    <Text
                      className={`text-base font-medium ${
                        isCompleted ? "text-green-700 line-through" : "text-gray-900"
                      }`}
                    >
                      {task.label}
                    </Text>
                    <Text
                      className={`text-xs ${
                        isCompleted ? "text-green-500" : "text-gray-500"
                      }`}
                    >
                      {task.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Encouragement */}
          {!allComplete && (
            <View className="mt-6 items-center">
              <Text className="text-gray-400 text-sm text-center">
                Tap a task to mark it complete. You've got this! 💪
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
