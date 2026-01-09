import { healthSyncService, HKCategoryValueSleepAnalysis } from "@/lib/healthSync";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Sleep quality emoji mapping
const SLEEP_QUALITY = [
  { value: 1, emoji: "😫", label: "Terrible" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 3, emoji: "😐", label: "Fair" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😴", label: "Great" },
];

// Format time for display
function formatTime(date: Date | null): string {
  if (!date) return "Tap to set";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Format duration in hours and minutes
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Sleep duration visualization
function SleepProgress({ 
  minutes, 
  goalHours 
}: { 
  minutes: number; 
  goalHours: number;
}) {
  const goalMinutes = goalHours * 60;
  const percent = Math.min(100, Math.round((minutes / goalMinutes) * 100));
  const size = 160;
  const strokeWidth = 12;
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
          stroke="#8B5CF6"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center">
        <Feather name="moon" size={32} color="#8B5CF6" />
        <Text className="text-2xl font-bold text-gray-800 mt-1">{formatDuration(minutes)}</Text>
        <Text className="text-sm text-gray-500">of {goalHours}h goal</Text>
      </View>
    </View>
  );
}

export default function LogSleepScreen() {
  const { challenge, todayLog, updateProgress } = useChallengeStore();

  const [bedtime, setBedtime] = useState<Date | null>(
    todayLog?.sleepStartTime ? new Date(todayLog.sleepStartTime) : null
  );
  const [wakeTime, setWakeTime] = useState<Date | null>(
    todayLog?.sleepEndTime ? new Date(todayLog.sleepEndTime) : null
  );
  const [quality, setQuality] = useState(todayLog?.sleepQuality ?? 3);
  const [saving, setSaving] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);
  
  // Time picker state
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
  const [showWakeTimePicker, setShowWakeTimePicker] = useState(false);

  const sleepGoalHours = challenge?.sleepGoalHours ?? 8;

  // Calculate sleep duration in minutes (only if both times are set)
  const calculateDuration = (): number => {
    if (!bedtime || !wakeTime) return 0;
    let duration = wakeTime.getTime() - bedtime.getTime();
    // If negative (wake time before bedtime), add 24 hours
    if (duration < 0) {
      duration += 24 * 60 * 60 * 1000;
    }
    return Math.round(duration / (1000 * 60));
  };

  const sleepMinutes = calculateDuration();
  const sleepHours = sleepMinutes / 60;
  const hasSetTimes = bedtime !== null && wakeTime !== null;
  const isGoalMet = hasSetTimes && sleepHours >= sleepGoalHours;

  // Load sleep data from Apple Health
  useEffect(() => {
    const loadHealthKitSleep = async () => {
      setLoadingHealth(true);
      try {
        const healthSleep = await healthSyncService.getSleepForDate(new Date());
        
        if (healthSleep && healthSleep.totalMinutes > 0) {
          // Pre-fill from HealthKit if no app data
          if (!todayLog?.sleepLogged) {
            if (healthSleep.startTime) setBedtime(healthSleep.startTime);
            if (healthSleep.endTime) setWakeTime(healthSleep.endTime);
          }
        }
      } catch (error) {
        console.log("Could not load HealthKit sleep:", error);
      } finally {
        setLoadingHealth(false);
      }
    };
    
    loadHealthKitSleep();
  }, [todayLog?.sleepLogged]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!bedtime || !wakeTime) {
      return; // Can't save without both times
    }
    
    setSaving(true);
    try {
      await updateProgress({
        sleepLogged: true,
        sleepMinutes,
        sleepStartTime: bedtime.toISOString(),
        sleepEndTime: wakeTime.toISOString(),
        sleepQuality: quality,
      });
      
      // Sync to Apple Health
      try {
        await healthSyncService.saveSleep(
          bedtime,
          wakeTime,
          HKCategoryValueSleepAnalysis.Asleep
        );
      } catch (healthError) {
        console.log("HealthKit sleep sync skipped:", healthError);
      }
      
      router.back();
    } catch (err) {
      console.error("Failed to save sleep:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Log Sleep</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-6">
          {/* Progress Circle */}
          <View className="items-center mb-8">
            {loadingHealth ? (
              <View className="items-center justify-center h-40">
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text className="text-sm text-gray-500 mt-2">Loading from Apple Health...</Text>
              </View>
            ) : (
              <>
                <SleepProgress minutes={sleepMinutes} goalHours={sleepGoalHours} />
                {!hasSetTimes && (
                  <Text className="mt-4 text-gray-500 text-sm">Set your bedtime and wake time below</Text>
                )}
                {hasSetTimes && isGoalMet && (
                  <View className="mt-4 bg-purple-100 px-4 py-2 rounded-full flex-row items-center">
                    <Feather name="check-circle" size={16} color="#7C3AED" />
                    <Text className="text-purple-700 font-semibold ml-2">Sleep goal reached!</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Bedtime & Wake Time */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-4">Sleep Times</Text>
            
            {/* Bedtime */}
            <Pressable 
              onPress={() => {
                setShowWakeTimePicker(false);
                setShowBedtimePicker(!showBedtimePicker);
                // Set default time if none selected
                if (!bedtime) {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  d.setHours(22, 30, 0, 0);
                  setBedtime(d);
                }
              }}
              className="flex-row items-center justify-between py-3 border-b border-gray-100"
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 bg-indigo-100 rounded-full items-center justify-center">
                  <Feather name="moon" size={20} color="#6366F1" />
                </View>
                <View className="ml-3">
                  <Text className="text-sm text-gray-500">Bedtime</Text>
                  <Text className="text-lg font-bold text-gray-800">{formatTime(bedtime)}</Text>
                </View>
              </View>
              <Feather name={showBedtimePicker ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
            </Pressable>
            
            {/* Bedtime Picker - directly below */}
            {showBedtimePicker && Platform.OS === "ios" && (
              <View className="py-4 border-b border-gray-100">
                <DateTimePicker
                  value={bedtime ?? (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    d.setHours(22, 30, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setBedtime(date);
                  }}
                  style={{ height: 180 }}
                />
              </View>
            )}
            
            {/* Wake Time */}
            <Pressable 
              onPress={() => {
                setShowBedtimePicker(false);
                setShowWakeTimePicker(!showWakeTimePicker);
                // Set default time if none selected
                if (!wakeTime) {
                  const d = new Date();
                  d.setHours(7, 0, 0, 0);
                  setWakeTime(d);
                }
              }}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 bg-amber-100 rounded-full items-center justify-center">
                  <Feather name="sunrise" size={20} color="#F59E0B" />
                </View>
                <View className="ml-3">
                  <Text className="text-sm text-gray-500">Wake Time</Text>
                  <Text className="text-lg font-bold text-gray-800">{formatTime(wakeTime)}</Text>
                </View>
              </View>
              <Feather name={showWakeTimePicker ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
            </Pressable>
            
            {/* Wake Time Picker - directly below */}
            {showWakeTimePicker && Platform.OS === "ios" && (
              <View className="py-4">
                <DateTimePicker
                  value={wakeTime ?? (() => {
                    const d = new Date();
                    d.setHours(7, 0, 0, 0);
                    return d;
                  })()}
                  mode="time"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setWakeTime(date);
                  }}
                  style={{ height: 180 }}
                />
              </View>
            )}
          </View>

          {/* Time Pickers for Android */}
          {showBedtimePicker && Platform.OS !== "ios" && (
            <DateTimePicker
              value={bedtime ?? (() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                d.setHours(22, 30, 0, 0);
                return d;
              })()}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowBedtimePicker(false);
                if (date) setBedtime(date);
              }}
            />
          )}
          
          {showWakeTimePicker && Platform.OS !== "ios" && (
            <DateTimePicker
              value={wakeTime ?? (() => {
                const d = new Date();
                d.setHours(7, 0, 0, 0);
                return d;
              })()}
              mode="time"
              display="default"
              onChange={(event, date) => {
                setShowWakeTimePicker(false);
                if (date) setWakeTime(date);
              }}
            />
          )}

          {/* Sleep Quality */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-4">How did you sleep?</Text>
            <View className="flex-row justify-between">
              {SLEEP_QUALITY.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setQuality(item.value)}
                  className={`items-center p-3 rounded-xl flex-1 mx-1 ${
                    quality === item.value ? "bg-purple-100" : "bg-gray-50"
                  }`}
                >
                  <Text className="text-2xl mb-1">{item.emoji}</Text>
                  <Text className={`text-xs ${
                    quality === item.value ? "text-purple-700 font-semibold" : "text-gray-500"
                  }`}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Sleep Stats */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-3">Sleep Summary</Text>
            <View className="flex-row">
              <View className="flex-1 items-center py-2 border-r border-gray-100">
                <Text className="text-2xl font-bold text-gray-800">
                  {hasSetTimes ? `${Math.floor(sleepHours)}h ${Math.round(sleepMinutes % 60)}m` : "--"}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">Total Sleep</Text>
              </View>
              <View className="flex-1 items-center py-2">
                <Text className="text-2xl font-bold text-gray-800">{sleepGoalHours}h</Text>
                <Text className="text-xs text-gray-500 mt-1">Goal</Text>
              </View>
            </View>
          </View>

          {/* Apple Health Info */}
          <View className="bg-purple-50 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <Feather name="heart" size={16} color="#7C3AED" />
              <Text className="text-sm font-semibold text-purple-800 ml-2">Apple Health Sync</Text>
            </View>
            <Text className="text-sm text-purple-700">
              Your sleep data syncs with Apple Health. If you use a sleep tracker, we'll automatically import your sleep times.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasSetTimes}
          className={`py-4 rounded-2xl items-center ${
            saving || !hasSetTimes ? "bg-gray-300" : "bg-purple-500"
          }`}
        >
          {saving ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white font-bold text-lg ml-2">Saving...</Text>
            </View>
          ) : (
            <Text className={`font-bold text-lg ${hasSetTimes ? "text-white" : "text-gray-500"}`}>
              {hasSetTimes ? "Save Sleep Log" : "Set times to save"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
