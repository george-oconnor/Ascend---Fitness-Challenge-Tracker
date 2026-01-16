import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TrackingOption = {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  hasGoal?: boolean;
  goalLabel?: string;
  goalKey?: string;
  goalType?: "number" | "float";
  isBeta?: boolean;
  bgColor?: string;
  iconColor?: string;
};

const TRACKING_OPTIONS: TrackingOption[] = [
  {
    key: "trackWorkout1",
    label: "Workout 1",
    description: "45+ minute workout",
    icon: "sun",
    hasGoal: true,
    goalLabel: "Minutes",
    goalKey: "workoutMinutes",
    goalType: "number",
    bgColor: "bg-orange-100",
    iconColor: "#F97316",
  },
  {
    key: "trackWorkout2",
    label: "Workout 2",
    description: "Another 45+ minute workout",
    icon: "activity",
    bgColor: "bg-violet-100",
    iconColor: "#8B5CF6",
  },
  {
    key: "trackDiet",
    label: "Follow Diet",
    description: "Stick to your chosen diet plan",
    icon: "check-square",
    bgColor: "bg-emerald-100",
    iconColor: "#10B981",
  },
  {
    key: "trackWater",
    label: "Drink Water",
    description: "Drink your daily water goal",
    icon: "droplet",
    hasGoal: true,
    goalLabel: "Liters",
    goalKey: "waterLiters",
    goalType: "float",
    bgColor: "bg-cyan-100",
    iconColor: "#06B6D4",
  },
  {
    key: "trackReading",
    label: "Read",
    description: "Read non-fiction pages daily",
    icon: "book-open",
    hasGoal: true,
    goalLabel: "Pages",
    goalKey: "readingPages",
    goalType: "number",
    bgColor: "bg-indigo-100",
    iconColor: "#6366F1",
  },
  {
    key: "trackProgressPhoto",
    label: "Progress Photo",
    description: "Take a progress photo",
    icon: "camera",
    hasGoal: true,
    goalLabel: "days",
    goalKey: "progressPhotoDays",
    goalType: "number",
    bgColor: "bg-fuchsia-100",
    iconColor: "#D946EF",
  },
  {
    key: "trackNoAlcohol",
    label: "No Alcohol",
    description: "Zero alcohol consumption",
    icon: "slash",
    bgColor: "bg-red-100",
    iconColor: "#EF4444",
  },
  {
    key: "trackMood",
    label: "Track Mood",
    description: "Log how you're feeling daily",
    icon: "smile",
    bgColor: "bg-yellow-100",
    iconColor: "#EAB308",
  },
  {
    key: "trackSleep",
    label: "Sleep Tracking",
    description: "Track your sleep duration and quality",
    icon: "moon",
    hasGoal: true,
    goalLabel: "Hours",
    goalKey: "sleepGoalHours",
    goalType: "number",
    bgColor: "bg-indigo-100",
    iconColor: "#6366F1",
  },
  {
    key: "trackCycle",
    label: "Cycle Tracking",
    description: "Track your menstrual cycle (Beta)",
    icon: "heart",
    isBeta: true,
    bgColor: "bg-pink-100",
    iconColor: "#EC4899",
  },
  {
    key: "trackSkincare",
    label: "Skincare Routine",
    description: "Complete daily skincare routine",
    icon: "sun",
    bgColor: "bg-teal-100",
    iconColor: "#14B8A6",
  },
  {
    key: "trackSteps",
    label: "Daily Steps",
    description: "Hit your step count goal",
    icon: "trending-up",
    hasGoal: true,
    goalLabel: "Steps",
    goalKey: "stepsGoal",
    goalType: "number",
    bgColor: "bg-green-100",
    iconColor: "#22C55E",
  },
];

export default function ChallengeSetupScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = edit === "true";

  const { user } = useSessionStore();
  const { challenge, saveChallenge, editChallenge, isLoading } = useChallengeStore();

  // Form state
  const [startDate, setStartDate] = useState<Date>(
    challenge?.startDate ? new Date(challenge.startDate) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [totalDays, setTotalDays] = useState(String(challenge?.totalDays ?? 75));

  // Tracking toggles
  const [tracking, setTracking] = useState<Record<string, boolean>>({
    trackWorkout1: challenge?.trackWorkout1 ?? true,
    trackWorkout2: challenge?.trackWorkout2 ?? true,
    trackDiet: challenge?.trackDiet ?? true,
    trackCalories: (challenge as any)?.trackCalories ?? true,
    trackWater: challenge?.trackWater ?? true,
    trackReading: challenge?.trackReading ?? true,
    trackProgressPhoto: challenge?.trackProgressPhoto ?? true,
    trackNoAlcohol: challenge?.trackNoAlcohol ?? true,
    trackMood: challenge?.trackMood ?? false,
    trackSleep: (challenge as any)?.trackSleep ?? false,
    trackCycle: (challenge as any)?.trackCycle ?? false,
    trackSteps: challenge?.trackSteps ?? false,
    trackWeight: challenge?.trackWeight ?? false,
    trackSkincare: challenge?.trackSkincare ?? false,
  });

  // Goals
  const [goals, setGoals] = useState<Record<string, string>>({
    workoutMinutes: String(challenge?.workoutMinutes ?? 45),
    waterLiters: String(challenge?.waterLiters ?? 3.0),
    readingPages: String(challenge?.readingPages ?? 10),
    stepsGoal: String(challenge?.stepsGoal ?? 10000),
    caloriesGoal: String(challenge?.caloriesGoal ?? 2000),
    weightGoal: String(challenge?.weightGoal ?? 0),
    sleepGoalHours: String((challenge as any)?.sleepGoalHours ?? 8),
    progressPhotoDays: String((challenge as any)?.progressPhotoDays ?? 1),
  });

  // Calorie goal direction (above or below)
  const [caloriesGoalDirection, setCaloriesGoalDirection] = useState<"above" | "below">(
    (challenge as any)?.caloriesGoalDirection ?? "below"
  );

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert("Error", "You must be logged in to create a challenge");
      return;
    }

    const challengeData = {
      userId: user.id,
      startDate: startDate.toISOString().split("T")[0],
      totalDays: parseInt(totalDays, 10) || 75,
      trackWorkout1: tracking.trackWorkout1,
      trackWorkout2: tracking.trackWorkout2,
      trackDiet: tracking.trackDiet,
      trackCalories: tracking.trackCalories,
      trackWater: tracking.trackWater,
      trackReading: tracking.trackReading,
      trackProgressPhoto: tracking.trackProgressPhoto,
      trackNoAlcohol: tracking.trackNoAlcohol,
      trackMood: tracking.trackMood,
      trackSleep: tracking.trackSleep,
      trackCycle: tracking.trackCycle,
      trackSteps: tracking.trackSteps,
      trackWeight: tracking.trackWeight,
      trackSkincare: tracking.trackSkincare,
      workoutMinutes: parseInt(goals.workoutMinutes, 10) || 45,
      waterLiters: parseFloat(goals.waterLiters) || 3.0,
      readingPages: parseInt(goals.readingPages, 10) || 10,
      stepsGoal: parseInt(goals.stepsGoal, 10) || 10000,
      caloriesGoal: parseInt(goals.caloriesGoal, 10) || 2000,
      caloriesGoalDirection,
      weightGoal: parseFloat(goals.weightGoal) || 0,
      sleepGoalHours: parseInt(goals.sleepGoalHours, 10) || 8,
      progressPhotoDays: parseInt(goals.progressPhotoDays, 10) || 1,
    };

    try {
      if (isEditing && challenge?.$id) {
        await editChallenge(challenge.$id, challengeData);
      } else {
        await saveChallenge(challengeData);
      }
      router.back();
    } catch (err) {
      Alert.alert("Error", "Failed to save challenge. Please try again.");
    }
  };

  const toggleTracking = (key: string) => {
    setTracking((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView className="flex-1 bg-purple-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-purple-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 bg-purple-100 rounded-full">
          <Feather name="x" size={24} color="#8B5CF6" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">
          {isEditing ? "Edit Challenge" : "Set Up Challenge"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Start Date */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-purple-100">
            <Text className="text-sm font-semibold text-purple-700 mb-3">Start Date</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between bg-gray-50 rounded-xl p-4"
            >
              <View className="flex-row items-center">
                <Feather name="calendar" size={20} color="#6B7280" />
                <Text className="text-base text-gray-900 ml-3">
                  {startDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (date) setStartDate(date);
                }}
                textColor="#000000"
                themeVariant="light"
              />
            )}
          </View>

          {/* Duration */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-purple-100">
            <Text className="text-sm font-semibold text-purple-700 mb-3">Challenge Duration</Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-4">
              <Feather name="clock" size={20} color="#6B7280" />
              <TextInput
                value={totalDays}
                onChangeText={setTotalDays}
                keyboardType="number-pad"
                className="flex-1 ml-3"
                style={{ fontSize: 16, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                placeholder="75"
              />
              <Text className="text-gray-500">days</Text>
            </View>
          </View>

          {/* Exercise */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-purple-100">
            <Text className="text-sm font-semibold text-purple-700 mb-4">Exercise</Text>

            {/* Workout 1 */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <Feather name="zap" size={18} color="#F97316" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Workout 1</Text>
                  <Text className="text-xs text-gray-500">{goals.workoutMinutes || "45"}+ minute workout</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackWorkout1}
                onValueChange={() => toggleTracking("trackWorkout1")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>
            {tracking.trackWorkout1 && (
              <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                <Text className="text-sm text-gray-600 mr-2">Minutes:</Text>
                <TextInput
                  value={goals.workoutMinutes}
                  onChangeText={(val) => setGoals((prev) => ({ ...prev, workoutMinutes: val }))}
                  keyboardType="number-pad"
                  className="flex-1"
                  style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                />
                <Text className="text-sm text-gray-500">min</Text>
              </View>
            )}

            <View className="h-px bg-gray-100 my-2" />

            {/* Workout 2 */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                  <Feather name="activity" size={18} color="#8B5CF6" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Workout 2</Text>
                  <Text className="text-xs text-gray-500">Another {goals.workoutMinutes || "45"}+ minute workout</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackWorkout2}
                onValueChange={() => toggleTracking("trackWorkout2")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>

            <View className="h-px bg-gray-100 my-2" />

            {/* Steps */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Feather name="trending-up" size={18} color="#22C55E" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Daily Steps</Text>
                  <Text className="text-xs text-gray-500">Hit your step count goal</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackSteps}
                onValueChange={() => toggleTracking("trackSteps")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>
            {tracking.trackSteps && (
              <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                <Text className="text-sm text-gray-600 mr-2">Goal:</Text>
                <TextInput
                  value={goals.stepsGoal}
                  onChangeText={(val) => setGoals((prev) => ({ ...prev, stepsGoal: val }))}
                  keyboardType="number-pad"
                  className="flex-1"
                  style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                />
                <Text className="text-sm text-gray-500">steps</Text>
              </View>
            )}
          </View>

          {/* Nutrition & Weight */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-purple-100">
            <Text className="text-sm font-semibold text-purple-700 mb-4">Nutrition & Weight</Text>

            {/* Track Calorie Intake */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                  <Feather name="bar-chart-2" size={18} color="#F43F5E" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Track Calorie Intake</Text>
                  <Text className="text-xs text-gray-500">Enable daily calorie tracking</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackCalories}
                onValueChange={() => toggleTracking("trackCalories")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>
            {tracking.trackCalories && (
              <>
                <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                  <Text className="text-sm text-gray-600 mr-2">Goal:</Text>
                  <TextInput
                    value={goals.caloriesGoal}
                    onChangeText={(val) => setGoals((prev) => ({ ...prev, caloriesGoal: val }))}
                    keyboardType="number-pad"
                    className="flex-1"
                    style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                  />
                  <Text className="text-sm text-gray-500">kcal</Text>
                </View>
                <View className="ml-13 mb-2">
                  <Text className="text-xs text-gray-600 mb-2">Goal Type:</Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setCaloriesGoalDirection("below")}
                      className={`flex-1 py-2 px-3 rounded-lg border ${
                        caloriesGoalDirection === "below" 
                          ? "bg-rose-100 border-rose-300" 
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Text className={`text-center text-sm ${
                        caloriesGoalDirection === "below" ? "text-rose-700 font-semibold" : "text-gray-600"
                      }`}>
                        Stay Under
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setCaloriesGoalDirection("above")}
                      className={`flex-1 py-2 px-3 rounded-lg border ${
                        caloriesGoalDirection === "above" 
                          ? "bg-rose-100 border-rose-300" 
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Text className={`text-center text-sm ${
                        caloriesGoalDirection === "above" ? "text-rose-700 font-semibold" : "text-gray-600"
                      }`}>
                        Eat At Least
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            <View className="h-px bg-gray-100 my-2" />

            {/* Follow Diet */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <Feather name="check-square" size={18} color="#10B981" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Follow Diet</Text>
                  <Text className="text-xs text-gray-500">Stick to your chosen diet plan</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackDiet}
                onValueChange={() => toggleTracking("trackDiet")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>

            <View className="h-px bg-gray-100 my-2" />

            {/* Water */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-cyan-100">
                  <Feather name="droplet" size={18} color="#06B6D4" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Drink Water</Text>
                  <Text className="text-xs text-gray-500">Drink your daily water goal</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackWater}
                onValueChange={() => toggleTracking("trackWater")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>
            {tracking.trackWater && (
              <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                <Text className="text-sm text-gray-600 mr-2">Goal:</Text>
                <TextInput
                  value={goals.waterLiters}
                  onChangeText={(val) => setGoals((prev) => ({ ...prev, waterLiters: val }))}
                  keyboardType="decimal-pad"
                  className="flex-1"
                  style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                />
                <Text className="text-sm text-gray-500">L</Text>
              </View>
            )}

            <View className="h-px bg-gray-100 my-2" />

            {/* No Alcohol */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Feather name="slash" size={18} color="#EF4444" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">No Alcohol</Text>
                  <Text className="text-xs text-gray-500">Zero alcohol consumption</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackNoAlcohol}
                onValueChange={() => toggleTracking("trackNoAlcohol")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>

            <View className="h-px bg-gray-100 my-2" />

            {/* Track Weight */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Feather name="trending-down" size={18} color="#F59E0B" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-medium text-gray-900">Track Weight</Text>
                  <Text className="text-xs text-gray-500">Enable daily weight tracking and target</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackWeight}
                onValueChange={() => toggleTracking("trackWeight")}
                trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                thumbColor="white"
              />
            </View>

            {tracking.trackWeight && (
              <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                <Text className="text-sm text-gray-600 mr-2">Target:</Text>
                <TextInput
                  value={goals.weightGoal}
                  onChangeText={(val) => setGoals((prev) => ({ ...prev, weightGoal: val }))}
                  keyboardType="decimal-pad"
                  className="flex-1"
                  style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                />
                <Text className="text-sm text-gray-500">kg</Text>
              </View>
            )}
          </View>

          {/* Removed separate Nutrition card; merged above */}

          {/* Habits */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-purple-100">
            <Text className="text-sm font-semibold text-purple-700 mb-4">Habits</Text>

            {["trackReading", "trackProgressPhoto", "trackMood", "trackSleep", "trackSkincare"].map((key, index, arr) => {
              const option = TRACKING_OPTIONS.find((o) => o.key === key)!;
              return (
                <View key={option.key}>
                  <View className="flex-row items-center justify-between py-3">
                    <View className="flex-row items-center flex-1">
                      <View className={`h-10 w-10 items-center justify-center rounded-full ${option.bgColor || "bg-gray-100"}`}>
                        <Feather name={option.icon} size={18} color={option.iconColor || "#6B7280"} />
                      </View>
                      <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-base font-medium text-gray-900">{option.label}</Text>
                          {option.isBeta && (
                            <View className="bg-purple-500 px-1.5 py-0.5 rounded ml-2">
                              <Text className="text-white text-[10px] font-bold">BETA</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-gray-500">{option.description}</Text>
                      </View>
                    </View>
                    <Switch
                      value={tracking[option.key]}
                      onValueChange={() => toggleTracking(option.key)}
                      trackColor={{ false: "#E5E7EB", true: "#8B5CF6" }}
                      thumbColor="white"
                    />
                  </View>

                  {/* Goal input if enabled and has goal */}
                  {option.hasGoal && tracking[option.key] && option.goalKey && (
                    <View className="ml-13 mb-2 flex-row items-center bg-gray-50 rounded-lg px-3 py-3">
                      <Text className="text-sm text-gray-600 mr-2">
                        {option.goalKey === "progressPhotoDays" ? "Photo every:" : "Goal:"}
                      </Text>
                      <TextInput
                        value={goals[option.goalKey]}
                        onChangeText={(val) =>
                          setGoals((prev) => ({ ...prev, [option.goalKey!]: val }))
                        }
                        keyboardType={option.goalType === "float" ? "decimal-pad" : "number-pad"}
                        className="flex-1"
                        style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                      />
                      <Text className="text-sm text-gray-500 ml-2">{option.goalLabel}</Text>
                    </View>
                  )}

                  {index < arr.length - 1 && (
                    <View className="h-px bg-gray-100" />
                  )}
                </View>
              );
            })}
          </View>

          {/* Health Tracking (Beta) */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row items-center mb-4">
              <Text className="text-sm font-semibold text-gray-700">Health Tracking</Text>
              <View className="bg-purple-500 px-1.5 py-0.5 rounded ml-2">
                <Text className="text-white text-[10px] font-bold">BETA</Text>
              </View>
            </View>

            {/* Cycle Tracking */}
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                  <Feather name="heart" size={18} color="#EC4899" />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-medium text-gray-900">Cycle Tracking</Text>
                  </View>
                  <Text className="text-xs text-gray-500">Track your menstrual cycle, symptoms & more</Text>
                </View>
              </View>
              <Switch
                value={tracking.trackCycle}
                onValueChange={() => toggleTracking("trackCycle")}
                trackColor={{ false: "#E5E7EB", true: "#EC4899" }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={isLoading}
          className="bg-primary rounded-xl py-4 items-center"
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">
              {isEditing ? "Save Changes" : "Start Challenge"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
