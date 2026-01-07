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
};

const TRACKING_OPTIONS: TrackingOption[] = [
  {
    key: "trackWorkout1",
    label: "Outdoor Workout",
    description: "45+ minutes outdoor exercise",
    icon: "sun",
    hasGoal: true,
    goalLabel: "Minutes",
    goalKey: "workoutMinutes",
    goalType: "number",
  },
  {
    key: "trackWorkout2",
    label: "Second Workout",
    description: "Additional 45+ minute workout",
    icon: "activity",
  },
  {
    key: "trackDiet",
    label: "Follow Diet",
    description: "Stick to your chosen diet plan",
    icon: "check-square",
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
  },
  {
    key: "trackProgressPhoto",
    label: "Progress Photo",
    description: "Take a daily progress photo",
    icon: "camera",
  },
  {
    key: "trackNoAlcohol",
    label: "No Alcohol",
    description: "Zero alcohol consumption",
    icon: "slash",
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
    trackWater: challenge?.trackWater ?? true,
    trackReading: challenge?.trackReading ?? true,
    trackProgressPhoto: challenge?.trackProgressPhoto ?? true,
    trackNoAlcohol: challenge?.trackNoAlcohol ?? true,
    trackSteps: challenge?.trackSteps ?? false,
  });

  // Goals
  const [goals, setGoals] = useState<Record<string, string>>({
    workoutMinutes: String(challenge?.workoutMinutes ?? 45),
    waterLiters: String(challenge?.waterLiters ?? 3.0),
    readingPages: String(challenge?.readingPages ?? 10),
    stepsGoal: String(challenge?.stepsGoal ?? 10000),
  });

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
      trackWater: tracking.trackWater,
      trackReading: tracking.trackReading,
      trackProgressPhoto: tracking.trackProgressPhoto,
      trackNoAlcohol: tracking.trackNoAlcohol,
      trackSteps: tracking.trackSteps,
      workoutMinutes: parseInt(goals.workoutMinutes, 10) || 45,
      waterLiters: parseFloat(goals.waterLiters) || 3.0,
      readingPages: parseInt(goals.readingPages, 10) || 10,
      stepsGoal: parseInt(goals.stepsGoal, 10) || 10000,
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="x" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">
          {isEditing ? "Edit Challenge" : "Set Up Challenge"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Start Date */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-700 mb-3">Start Date</Text>
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
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-700 mb-3">Challenge Duration</Text>
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

          {/* Tracking Options */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-700 mb-4">What to Track</Text>

            {TRACKING_OPTIONS.map((option, index) => (
              <View key={option.key}>
                <View className="flex-row items-center justify-between py-3">
                  <View className="flex-row items-center flex-1">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <Feather name={option.icon} size={18} color="#6B7280" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-medium text-gray-900">{option.label}</Text>
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
                    <Text className="text-sm text-gray-600 mr-2">Goal:</Text>
                    <TextInput
                      value={goals[option.goalKey]}
                      onChangeText={(val) =>
                        setGoals((prev) => ({ ...prev, [option.goalKey!]: val }))
                      }
                      keyboardType={option.goalType === "float" ? "decimal-pad" : "number-pad"}
                      className="flex-1"
                      style={{ fontSize: 14, color: "#111827", padding: 0, margin: 0, includeFontPadding: false }}
                    />
                    <Text className="text-sm text-gray-500">{option.goalLabel}</Text>
                  </View>
                )}

                {index < TRACKING_OPTIONS.length - 1 && (
                  <View className="h-px bg-gray-100" />
                )}
              </View>
            ))}
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
