import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ChallengeStatusCard() {
  const { challenge, todayLog, isLoading } = useChallengeStore();

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
            <Text className="text-white text-lg font-bold mb-1">
              Start Your 75 Hard Challenge 💪
            </Text>
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
  
  const daysPassed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const hasStarted = daysPassed >= 1;
  const currentDay = hasStarted ? Math.min(daysPassed, challenge.totalDays) : 0;
  const progressPercent = hasStarted ? (currentDay / challenge.totalDays) * 100 : 0;
  const daysUntilStart = hasStarted ? 0 : Math.abs(daysPassed - 1);

  // Calculate today's tasks
  const trackedTasks: { key: string; label: string; completed: boolean }[] = [];

  if (challenge.trackSteps) {
    trackedTasks.push({ key: "steps", label: "Steps", completed: todayLog?.stepsCompleted ?? false });
  }
  if (challenge.trackWater) {
    trackedTasks.push({ key: "water", label: "Water", completed: todayLog?.waterCompleted ?? false });
  }
  if (challenge.trackDiet) {
    trackedTasks.push({ key: "diet", label: "Diet", completed: todayLog?.dietCompleted ?? false });
  }
  if (challenge.trackWorkout1) {
    trackedTasks.push({ key: "workout1", label: "Workout 1", completed: todayLog?.workout1Completed ?? false });
  }
  if (challenge.trackWorkout2) {
    trackedTasks.push({ key: "workout2", label: "Workout 2", completed: todayLog?.workout2Completed ?? false });
  }
  if (challenge.trackReading) {
    trackedTasks.push({ key: "reading", label: "Reading", completed: todayLog?.readingCompleted ?? false });
  }
  if (challenge.trackProgressPhoto) {
    trackedTasks.push({ key: "photo", label: "Photo", completed: todayLog?.progressPhotoCompleted ?? false });
  }
  if (challenge.trackNoAlcohol) {
    trackedTasks.push({ key: "alcohol", label: "No Alcohol", completed: todayLog?.noAlcoholCompleted ?? false });
  }

  const completedCount = trackedTasks.filter((t) => t.completed).length;
  const allComplete = trackedTasks.length > 0 && completedCount === trackedTasks.length;

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
            <Text className="text-xl font-bold text-gray-900">75 Hard Challenge</Text>
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
                {challenge.totalDays} day challenge • {trackedTasks.length} daily tasks
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
          <Text className="text-xs text-gray-500 uppercase tracking-wide">Day {currentDay} of {challenge.totalDays}</Text>
          <Text className="text-xl font-bold text-gray-900">75 Hard Challenge</Text>
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
      <View className="mb-4">
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

      {/* Today's status */}
      <View className="bg-gray-50 rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold text-gray-700">Today's Progress</Text>
          {allComplete ? (
            <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text className="text-xs text-green-600 ml-1 font-medium">All Done!</Text>
            </View>
          ) : (
            <Text className="text-xs text-gray-500">
              {completedCount}/{trackedTasks.length} tasks
            </Text>
          )}
        </View>

        {/* Task pills */}
        <View className="flex-row flex-wrap gap-2">
          {trackedTasks.map((task) => (
            <View
              key={task.key}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                task.completed ? "bg-green-100" : "bg-gray-200"
              }`}
            >
              <Feather
                name={task.completed ? "check" : "circle"}
                size={12}
                color={task.completed ? "#22C55E" : "#9CA3AF"}
              />
              <Text
                className={`text-xs ml-1.5 ${
                  task.completed ? "text-green-700" : "text-gray-600"
                }`}
              >
                {task.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tap hint */}
      <Text className="text-xs text-gray-400 text-center mt-3">
        Tap to log today's progress
      </Text>
    </Pressable>
  );
}
