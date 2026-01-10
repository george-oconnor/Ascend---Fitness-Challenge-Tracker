import { healthSyncService } from "@/lib/healthSync";
import { captureException } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Circular progress for water
function WaterProgress({ current, goal }: { current: number; goal: number }) {
  const percent = Math.min(100, Math.round((current / goal) * 100));
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
          stroke="#06B6D4"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center">
        <Feather name="droplet" size={32} color="#06B6D4" />
        <Text className="text-2xl font-bold text-gray-800 mt-1">{current.toFixed(2)}L</Text>
        <Text className="text-sm text-gray-500">of {goal}L</Text>
      </View>
    </View>
  );
}

// Water slider with step markers
function WaterSlider({ 
  value, 
  goal, 
  onChange 
}: { 
  value: number; 
  goal: number; 
  onChange: (val: number) => void;
}) {
  const steps = Math.ceil(goal / 0.25);
  const stepMarkers = Array.from({ length: steps + 1 }, (_, i) => i * 0.25);
  
  return (
    <View>
      {/* Slider */}
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={goal}
        step={0.25}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#06B6D4"
        maximumTrackTintColor="#E5E7EB"
        thumbTintColor="#06B6D4"
      />
      
      {/* Step markers */}
      <View className="flex-row justify-between px-2 mt-1">
        {stepMarkers.filter((_, i) => i % 4 === 0 || i === stepMarkers.length - 1).map((marker, index) => (
          <View key={index} className="items-center">
            <View className={`h-2 w-0.5 ${value >= marker ? "bg-cyan-500" : "bg-gray-300"}`} />
            <Text className={`text-xs mt-1 ${value >= marker ? "text-cyan-600 font-medium" : "text-gray-400"}`}>
              {marker}L
            </Text>
          </View>
        ))}
      </View>
      
      {/* Current value indicator */}
      <View className="items-center mt-4">
        <View className="bg-cyan-100 px-4 py-2 rounded-full">
          <Text className="text-cyan-700 font-bold text-lg">{value.toFixed(2)}L</Text>
        </View>
      </View>
    </View>
  );
}

export default function LogWaterScreen() {
  const { challenge, todayLog, updateProgress } = useChallengeStore();
  const [water, setWater] = useState(todayLog?.waterLiters ?? 0);
  const [saving, setSaving] = useState(false);
  const [healthKitWater, setHealthKitWater] = useState<number | null>(null);

  // Load water from Apple Health on mount
  useEffect(() => {
    const loadHealthKitWater = async () => {
      try {
        const hkWater = await healthSyncService.getWaterIntakeForDate(new Date());
        if (hkWater !== null) {
          setHealthKitWater(hkWater);
          // If no app data but HealthKit has data, pre-fill
          if (!todayLog?.waterLiters && hkWater > 0) {
            setWater(hkWater);
          }
        }
      } catch (error) {
        console.log("Could not load HealthKit water:", error);
      }
    };
    loadHealthKitWater();
  }, [todayLog?.waterLiters]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const goal = challenge.waterLiters ?? 3;
  const isComplete = water >= goal;

  const handleQuickAdd = (amount: number) => {
    setWater((prev) => Math.min(goal * 1.5, Math.max(0, prev + amount)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProgress({
        waterLiters: water,
        waterCompleted: water >= goal,
      });
      
      // Sync to Apple Health
      try {
        // Only sync the difference if we have existing HealthKit data
        const amountToSync = healthKitWater !== null ? water - healthKitWater : water;
        if (amountToSync > 0) {
          await healthSyncService.saveWaterIntake(amountToSync);
        }
      } catch (healthError: any) {
        console.error("Error saving water to HealthKit:", healthError);
        const amountToSync = healthKitWater !== null ? water - healthKitWater : water;
        captureException(new Error(`Apple Health water sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
          waterAmount: amountToSync,
        });
      }
      
      router.back();
    } catch (err) {
      console.error("Failed to save water:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-cyan-50 to-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Log Water</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
        {/* Progress Circle */}
        <View className="items-center mb-8">
          <WaterProgress current={water} goal={goal} />
          {isComplete && (
            <View className="mt-4 bg-cyan-100 px-4 py-2 rounded-full flex-row items-center">
              <Feather name="check-circle" size={16} color="#0E7490" />
              <Text className="text-cyan-700 font-semibold ml-2">Goal reached!</Text>
            </View>
          )}
        </View>

        {/* Quick Add Buttons */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Quick Add</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleQuickAdd(0.25)}
              className="flex-1 bg-cyan-50 py-3 rounded-xl items-center"
            >
              <Text className="text-2xl">💧</Text>
              <Text className="text-xs font-medium text-cyan-700 mt-1">+0.25L</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAdd(0.5)}
              className="flex-1 bg-cyan-50 py-3 rounded-xl items-center"
            >
              <Text className="text-2xl">💧</Text>
              <Text className="text-xs font-medium text-cyan-700 mt-1">+0.5L</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAdd(1)}
              className="flex-1 bg-cyan-50 py-3 rounded-xl items-center"
            >
              <Text className="text-2xl">🧃</Text>
              <Text className="text-xs font-medium text-cyan-700 mt-1">+1L</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAdd(-0.25)}
              className="flex-1 bg-red-50 py-3 rounded-xl items-center"
            >
              <Text className="text-2xl">➖</Text>
              <Text className="text-xs font-medium text-red-600 mt-1">-0.25L</Text>
            </Pressable>
          </View>
        </View>

        {/* Water Slider */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Set amount</Text>
          <WaterSlider value={water} goal={goal} onChange={setWater} />
        </View>

        {/* Hydration Tips */}
        <View className="bg-cyan-50 rounded-2xl p-4">
          <View className="flex-row items-center mb-2">
            <Feather name="heart" size={16} color="#155E75" />
            <Text className="text-sm font-semibold text-cyan-800 ml-2">Apple Health Sync</Text>
          </View>
          <Text className="text-sm text-cyan-700">
            Your water intake syncs with Apple Health automatically when you save.
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`py-4 rounded-2xl items-center ${
            saving ? "bg-gray-300" : "bg-cyan-500"
          }`}
        >
          {saving ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white font-bold text-lg ml-2">Saving...</Text>
            </View>
          ) : (
            <Text className="text-white font-bold text-lg">Save Water Intake</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
