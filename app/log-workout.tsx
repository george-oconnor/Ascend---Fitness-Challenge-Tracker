import { createActivityLog, getActivityLogsForDate, updateActivityLog, updateDailyLog } from "@/lib/appwrite";
import { healthService } from "@/lib/health";
import { captureException } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Workout type options
const WORKOUT_TYPES: { id: string; label: string; emoji: string; isOutdoor: boolean }[] = [
  { id: "running", label: "Running", emoji: "🏃", isOutdoor: true },
  { id: "walking", label: "Walking", emoji: "🚶", isOutdoor: true },
  { id: "cycling", label: "Cycling", emoji: "🚴", isOutdoor: true },
  { id: "hiking", label: "Hiking", emoji: "🥾", isOutdoor: true },
  { id: "swimming", label: "Swimming", emoji: "🏊", isOutdoor: true },
  { id: "rowing", label: "Rowing", emoji: "🚣", isOutdoor: true },
  { id: "strength", label: "Strength Training", emoji: "🏋️", isOutdoor: false },
  { id: "hiit", label: "HIIT", emoji: "⚡", isOutdoor: false },
  { id: "yoga", label: "Yoga", emoji: "🧘", isOutdoor: false },
  { id: "pilates", label: "Pilates", emoji: "🤸", isOutdoor: false },
  { id: "crossfit", label: "CrossFit", emoji: "💪", isOutdoor: false },
  { id: "boxing", label: "Boxing", emoji: "🥊", isOutdoor: false },
  { id: "dance", label: "Dance", emoji: "💃", isOutdoor: false },
  { id: "indoor-rowing", label: "Indoor Rowing", emoji: "🚣", isOutdoor: false },
  { id: "other", label: "Other", emoji: "🏅", isOutdoor: false },
];

// Circular progress for workout
function WorkoutProgress({ current, goal, color }: { current: number; goal: number; color: string }) {
  const percent = Math.min(100, Math.round((current / goal) * 100));
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
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
      <View className="items-center">
        <Text className="text-3xl font-bold text-gray-800">{current}</Text>
        <Text className="text-sm text-gray-500">of {goal} min</Text>
      </View>
    </View>
  );
}

// Parse workout details from JSON string
type WorkoutDetailsData = {
  workout1?: { type: string; notes: string; syncedFromHealth: boolean };
  workout2?: { type: string; notes: string; syncedFromHealth: boolean };
};

function parseWorkoutDetails(detailsString?: string): WorkoutDetailsData {
  if (!detailsString) {
    return {};
  }
  try {
    return JSON.parse(detailsString);
  } catch {
    return {};
  }
}

export default function LogWorkoutScreen() {
  const { workout: workoutParam, date: dateParam, logId: logIdParam } = useLocalSearchParams<{ workout: string; date?: string; logId?: string }>();
  const workoutNumber = workoutParam === "2" ? 2 : 1;
  const isWorkout1 = workoutNumber === 1;
  
  const { challenge, todayLog, updateProgress, allLogs } = useChallengeStore();
  const { workouts: healthWorkouts, isAuthorized: healthAuthorized } = useHealthStore();
  
  // Determine which log we're editing
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  // Parse existing workout details
  const existingDetails = parseWorkoutDetails(targetLog?.workoutDetails);
  const existingWorkout = isWorkout1 ? existingDetails.workout1 : existingDetails.workout2;
  
  // Get existing values from targetLog
  const existingMinutes = isWorkout1 ? (targetLog?.workout1Minutes ?? 0) : (targetLog?.workout2Minutes ?? 0);
  
  const [minutes, setMinutes] = useState(existingMinutes);
  const [selectedType, setSelectedType] = useState(existingWorkout?.type ?? "");
  const [notes, setNotes] = useState(existingWorkout?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [syncToHealth, setSyncToHealth] = useState(true);

  // Config based on workout number
  const config = isWorkout1 
    ? { color: "#F97316", lightBg: "bg-orange-50", label: "Workout 1", icon: "activity" as keyof typeof Feather.glyphMap }
    : { color: "#8B5CF6", lightBg: "bg-purple-50", label: "Workout 2", icon: "activity" as keyof typeof Feather.glyphMap };

  // Get synced workouts from Apple Health
  const isIOS = Platform.OS === "ios";
  const syncedWorkouts = isIOS && healthAuthorized ? healthWorkouts : [];
  
  // Calculate synced minutes for this workout slot based on current stored value
  // This ensures consistency with the sync logic in useChallengeStore
  const syncedMinutes = existingMinutes > 0 && existingWorkout?.syncedFromHealth 
    ? existingMinutes 
    : 0;

  // Load synced workout details if available and no manual entry exists
  useEffect(() => {
    if (syncedWorkouts.length > 0 && existingMinutes > 0 && !existingWorkout?.type) {
      // Use the primary workout for type, but minutes come from store sync logic
      const primaryWorkout = syncedWorkouts[0];
      setMinutes(existingMinutes);
      setSelectedType(primaryWorkout.activityName.toLowerCase().replace(/\s+/g, "-"));
      setNotes(`Synced from Apple Health: ${syncedWorkouts.map(w => `${w.activityName} (${w.duration}min)`).join(", ")}`);
    }
  }, [syncedWorkouts.length, existingMinutes, existingWorkout?.type]);

  if (!challenge || !targetLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const goal = challenge.workoutMinutes ?? 45;
  const totalMinutes = Math.max(minutes, Math.round(syncedMinutes));
  const isComplete = totalMinutes >= goal;

  const handleQuickAdd = (amount: number) => {
    setMinutes((prev) => Math.max(0, prev + amount));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build the new workout details, preserving the other workout's data
      const currentDetails = parseWorkoutDetails(targetLog?.workoutDetails);
      const isManualEntry = minutes > 0 && syncedMinutes === 0;
      
      // Get existing workout data to preserve fields like calories, distance
      const existingWorkoutData = isWorkout1 ? currentDetails.workout1 : currentDetails.workout2;
      
      // Find the workout type info
      const workoutTypeInfo = WORKOUT_TYPES.find(t => t.id === selectedType);
      
      // For manually logged workouts, use current time or estimate end time as now
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - totalMinutes * 60 * 1000);
      
      // Build complete workout data object, preserving existing fields
      const newWorkoutData = {
        ...existingWorkoutData, // Preserve existing fields like calories, distance
        type: selectedType,
        notes: notes,
        syncedFromHealth: syncedMinutes > 0,
        syncedToHealth: isManualEntry && syncToHealth,
        activityName: workoutTypeInfo?.label || selectedType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        isOutdoor: workoutTypeInfo?.isOutdoor ?? false,
        // Include start and end times - use existing if available, otherwise calculate
        startTime: existingWorkoutData?.startTime || startTime.toISOString(),
        endTime: existingWorkoutData?.endTime || endTime.toISOString(),
      };

      const updatedDetails: WorkoutDetailsData = {
        ...currentDetails,
        [isWorkout1 ? "workout1" : "workout2"]: newWorkoutData,
      };

      const updates = {
        [isWorkout1 ? "workout1Minutes" : "workout2Minutes"]: totalMinutes,
        [isWorkout1 ? "workout1Completed" : "workout2Completed"]: totalMinutes >= goal,
        workoutDetails: JSON.stringify(updatedDetails),
      };

      if (isEditingPastDay && logIdParam) {
        // Update specific past day's log
        await updateDailyLog(logIdParam, updates);
        
        // Create or update activity log
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const activityType = isWorkout1 ? 'workout1' : 'workout2';
        const existingLogs = await getActivityLogsForDate(challenge.$id!, dateStr, activityType);
        const workoutType = WORKOUT_TYPES.find(t => t.id === selectedType);
        
        const activityData = {
          userId: challenge.userId,
          challengeId: challenge.$id!,
          type: activityType as const,
          title: `${isWorkout1 ? "Workout 1" : "Workout 2"} Complete`,
          description: `${workoutType?.label || "Workout"} - ${totalMinutes} minutes${notes ? ` - ${notes}` : ""}`,
          value: totalMinutes,
          unit: "minutes",
          date: dateStr,
        };
        
        if (existingLogs.length > 0) {
          await updateActivityLog(existingLogs[0].$id!, activityData);
        } else {
          await createActivityLog(activityData);
        }
        
        // Refresh the data
        const { fetchAllLogs, fetchActivityLogs } = useChallengeStore.getState();
        await Promise.all([
          fetchAllLogs(challenge.$id!),
          fetchActivityLogs(challenge.$id!)
        ]);
      } else {
        // Sync manual workout to Apple Health if enabled and this is a manual entry
        if (isIOS && syncToHealth && isManualEntry && selectedType) {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - minutes * 60 * 1000);
          
          try {
            await healthService.saveWorkout({
              type: selectedType,
              startDate,
              endDate,
            });
          } catch (healthError: any) {
            console.error("Error saving workout to HealthKit:", healthError);
            captureException(new Error(`Apple Health workout sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
              workoutType: selectedType,
              minutes,
              workoutNumber: workoutNumber,
            });
          }
        }

        // Update today's log using the store method
        await updateProgress(updates);

        // Log activity to feed
        const { logActivity } = useChallengeStore.getState();
        const workoutType = WORKOUT_TYPES.find(t => t.id === selectedType);
        await logActivity({
          type: isWorkout1 ? "workout1" : "workout2",
          title: `${isWorkout1 ? "Workout 1" : "Workout 2"} Complete`,
          description: `${workoutType?.label || "Workout"} - ${totalMinutes} minutes${notes ? ` - ${notes}` : ""}`,
          value: totalMinutes,
          unit: "minutes",
        });
      }

      router.back();
    } catch (err) {
      console.error("Failed to save workout:", err);
      captureException(new Error(`Failed to save workout: ${err instanceof Error ? err.message : JSON.stringify(err)}`), {
        minutes,
        workoutNumber,
        selectedType,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWorkout = async () => {
    setSaving(true);
    try {
      // Get current workout details and remove this workout's data
      const currentDetails = parseWorkoutDetails(targetLog?.workoutDetails);
      const updatedDetails: WorkoutDetailsData = {
        ...currentDetails,
      };
      
      // Remove the specific workout data
      if (isWorkout1) {
        delete updatedDetails.workout1;
      } else {
        delete updatedDetails.workout2;
      }

      const updates = {
        [isWorkout1 ? "workout1Minutes" : "workout2Minutes"]: 0,
        [isWorkout1 ? "workout1Completed" : "workout2Completed"]: false,
        workoutDetails: JSON.stringify(updatedDetails),
      };

      if (isEditingPastDay && logIdParam) {
        // Update specific past day's log
        await updateDailyLog(logIdParam, updates);
        
        // Delete activity log if exists
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const activityType = isWorkout1 ? 'workout1' : 'workout2';
        const existingLogs = await getActivityLogsForDate(challenge.$id!, dateStr, activityType);
        
        for (const log of existingLogs) {
          if (log.$id) {
            const { deleteActivityLog } = await import("@/lib/appwrite");
            await deleteActivityLog(log.$id);
          }
        }
        
        // Refresh the data
        const { fetchAllLogs, fetchActivityLogs } = useChallengeStore.getState();
        await Promise.all([
          fetchAllLogs(challenge.$id!),
          fetchActivityLogs(challenge.$id!)
        ]);
      } else {
        // Reset today's workout data in Appwrite
        await updateProgress(updates);
      }

      router.back();
    } catch (err) {
      console.error("Failed to remove workout:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-bold text-gray-900">Log {config.label}</Text>
          {isEditingPastDay && (
            <Text className="text-xs text-gray-500">{format(targetDate, 'MMM d, yyyy')}</Text>
          )}
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
        {/* Header with icon and progress */}
        <View className="items-center mb-6">
          <View className="h-20 w-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: config.color + "20" }}>
            <Feather name={config.icon} size={40} color={config.color} />
          </View>
          <WorkoutProgress current={totalMinutes} goal={goal} color={config.color} />
          {isComplete && (
            <View className="mt-4 bg-green-100 px-4 py-2 rounded-full flex-row items-center">
              <Feather name="check-circle" size={16} color="#15803D" />
              <Text className="text-green-700 font-semibold ml-2">Goal reached!</Text>
            </View>
          )}
        </View>

        {/* Synced from Health indicator */}
        {isIOS && syncedMinutes > 0 && (
          <View className="bg-purple-50 rounded-2xl p-4 mb-6 flex-row items-center">
            <Feather name="heart" size={20} color="#8B5CF6" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-purple-800">
                Synced from Apple Health
              </Text>
              <Text className="text-xs text-purple-600 mt-0.5">
                {syncedWorkouts.length} workout{syncedWorkouts.length !== 1 ? "s" : ""} • {Math.round(syncedMinutes)} minutes assigned to {config.label}
              </Text>
            </View>
          </View>
        )}

        {/* Manual Duration Input */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">
            {syncedMinutes > 0 ? "Add More Time (Manual)" : "Workout Duration"}
          </Text>
          <View className="flex-row items-center justify-center">
            <Pressable
              onPress={() => handleQuickAdd(-5)}
              className="bg-gray-100 h-12 w-12 rounded-full items-center justify-center"
            >
              <Feather name="minus" size={20} color="#6B7280" />
            </Pressable>
            <View className="mx-6 items-center">
              <Text className="text-4xl font-bold text-gray-800">{minutes}</Text>
              <Text className="text-sm text-gray-500">minutes</Text>
            </View>
            <Pressable
              onPress={() => handleQuickAdd(5)}
              className={`h-12 w-12 rounded-full items-center justify-center ${config.lightBg}`}
            >
              <Feather name="plus" size={20} color={config.color} />
            </Pressable>
          </View>
          
          {/* Quick add buttons */}
          <View className="flex-row justify-center mt-4 gap-2">
            {[15, 30, 45, 60].map((mins) => (
              <Pressable
                key={mins}
                onPress={() => setMinutes(mins)}
                className={`px-4 py-2 rounded-lg ${minutes === mins ? config.lightBg : "bg-gray-100"}`}
              >
                <Text className={`text-sm font-medium ${minutes === mins ? "text-gray-800" : "text-gray-600"}`}>
                  {mins}m
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Workout Type Selection */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Workout Type</Text>
          <View className="flex-row flex-wrap gap-2">
            {WORKOUT_TYPES.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                className={`flex-row items-center px-3 py-2 rounded-xl ${
                  selectedType === type.id ? config.lightBg : "bg-gray-100"
                }`}
              >
                <Text className="mr-1">{type.emoji}</Text>
                <Text className={`text-sm ${
                  selectedType === type.id ? "font-semibold text-gray-800" : "text-gray-600"
                }`}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Notes (Optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="How did your workout go? Any achievements?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="bg-gray-50 rounded-xl p-3 text-gray-800 min-h-[80px]"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {/* Sync to Apple Health toggle (iOS only, for manual entries) */}
        {isIOS && minutes > 0 && syncedMinutes === 0 && (
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="h-10 w-10 rounded-full bg-red-50 items-center justify-center">
                <Feather name="heart" size={20} color="#EF4444" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-800">Sync to Apple Health</Text>
                <Text className="text-xs text-gray-500">Add this workout to your Health data</Text>
              </View>
            </View>
            <Switch
              value={syncToHealth}
              onValueChange={setSyncToHealth}
              trackColor={{ false: "#D1D5DB", true: "#EF4444" }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {/* Workout Tip */}
        <View className={`${config.lightBg} rounded-2xl p-4`}>
          <View className="flex-row items-center mb-2">
            <Feather name="info" size={16} color="#374151" />
            <Text className="text-sm font-semibold text-gray-800 ml-2">Workout Tip</Text>
          </View>
          <Text className="text-sm text-gray-700">
            {isWorkout1
              ? "Morning workouts can boost your energy for the entire day!"
              : "Evening workouts can help relieve stress and improve sleep quality."}
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={saving || totalMinutes === 0}
          className={`py-4 rounded-2xl items-center mb-3 ${
            saving || totalMinutes === 0 ? "bg-gray-300" : ""
          }`}
          style={!(saving || totalMinutes === 0) ? { backgroundColor: config.color } : undefined}
        >
          <Text className="text-white font-bold text-lg">
            {saving ? "Saving..." : "Save Workout"}
          </Text>
        </Pressable>

        {/* Remove Workout Button - only show if workout exists */}
        {existingMinutes > 0 && (
          <Pressable
            onPress={handleRemoveWorkout}
            disabled={saving}
            className="py-3 rounded-2xl items-center border-2 border-red-500"
          >
            <View className="flex-row items-center">
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text className="text-red-500 font-semibold text-base ml-2">
                Remove Workout
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
