import { createActivityLog, getActivityLogsForDate, updateActivityLog, updateDailyLog } from "@/lib/appwrite";
import { healthService } from "@/lib/health";
import { healthSyncService } from "@/lib/healthSync";
import { captureException, captureMessage } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Scale visualization
function ScaleDisplay({ weight, goal }: { weight: number; goal: number }) {
  const diff = weight - goal;
  const isAtGoal = Math.abs(diff) < 0.5;
  const isAboveGoal = diff > 0;
  
  // Animation for scale ticks - true infinite scroll
  const tickOffset = useRef(new Animated.Value(0)).current;
  const baseWeight = useRef(weight).current; // Store initial weight
  
  // If starting from 0, need more ticks to handle scrolling to 120kg
  const tickCount = baseWeight < 5 ? 200 : 80;
  const startOffset = baseWeight < 5 ? -50 : -200;
  
  useEffect(() => {
    // Simple offset based on weight change from initial - no modulo = no jump
    const offset = (weight - baseWeight) * 10;
    
    Animated.spring(tickOffset, {
      toValue: -offset,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [weight]);
  
  // Render ticks based on starting weight
  const renderTicks = () => {
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(
        <View 
          key={i} 
          className={`w-0.5 h-3 mx-1 ${i % 9 === 4 ? 'bg-indigo-400 h-4' : 'bg-gray-300'}`} 
        />
      );
    }
    return ticks;
  };
  
  return (
    <View className="items-center">
      {/* Scale platform */}
      <View className="bg-gray-200 h-4 w-48 rounded-full mb-2" />
      
      {/* Scale body */}
      <View className="bg-gray-50 w-56 h-28 rounded-3xl items-center justify-center relative overflow-hidden">
        {/* Decorative lines - animated */}
        <Animated.View 
          className="absolute top-2 flex-row"
          style={{
            transform: [{ translateX: tickOffset }],
            left: startOffset, // Adjust based on starting weight
          }}
        >
          {renderTicks()}
        </Animated.View>
        
        <Text className="text-5xl font-bold text-gray-800">{weight.toFixed(1)}</Text>
        <Text className="text-sm text-gray-500 mt-1">kg</Text>
      </View>
      
      {/* Goal indicator */}
      {goal > 0 && (
        <View className={`mt-4 px-4 py-2 rounded-full flex-row items-center ${
          isAtGoal ? 'bg-green-100' : isAboveGoal ? 'bg-orange-100' : 'bg-blue-100'
        }`}>
          <Feather 
            name={isAtGoal ? "check-circle" : isAboveGoal ? "arrow-up" : "arrow-down"} 
            size={16} 
            color={isAtGoal ? "#22C55E" : isAboveGoal ? "#F97316" : "#3B82F6"} 
          />
          <Text className={`ml-2 font-medium ${
            isAtGoal ? 'text-green-700' : isAboveGoal ? 'text-orange-700' : 'text-blue-700'
          }`}>
            {isAtGoal 
              ? "At goal weight!" 
              : `${Math.abs(diff).toFixed(1)}kg ${isAboveGoal ? 'above' : 'to'} goal`}
          </Text>
        </View>
      )}
    </View>
  );
}

// Trend arrow component
function TrendIndicator({ current, previous }: { current: number; previous?: number }) {
  if (!previous || previous === 0) return null;
  
  const diff = current - previous;
  const isUp = diff > 0;
  const isStable = Math.abs(diff) < 0.1;
  
  return (
    <View className={`flex-row items-center px-3 py-1 rounded-full ${
      isStable ? 'bg-gray-100' : isUp ? 'bg-orange-100' : 'bg-green-100'
    }`}>
      <Feather 
        name={isStable ? "minus" : isUp ? "trending-up" : "trending-down"} 
        size={14} 
        color={isStable ? "#6B7280" : isUp ? "#F97316" : "#22C55E"} 
      />
      <Text className={`ml-1 text-xs font-medium ${
        isStable ? 'text-gray-600' : isUp ? 'text-orange-600' : 'text-green-600'
      }`}>
        {isStable ? "Stable" : `${isUp ? '+' : ''}${diff.toFixed(1)}kg`}
      </Text>
    </View>
  );
}

export default function LogWeightScreen() {
  const { date: dateParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; logId?: string }>();
  const { challenge, todayLog, updateProgress, allLogs, fetchAllLogs } = useChallengeStore();
  
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [weight, setWeight] = useState(targetLog?.currentWeight ?? 0);
  const [inputValue, setInputValue] = useState(
    targetLog?.currentWeight ? targetLog.currentWeight.toFixed(1) : ""
  );
  const [saving, setSaving] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);

  // Load weight from Apple Health on mount (iOS only)
  useEffect(() => {
    async function loadHealthWeight() {
      if (Platform.OS !== "ios") return;
      
      // Only load from Health if no weight has been logged today
      if (targetLog?.currentWeight && targetLog.currentWeight > 0) return;
      
      setLoadingHealth(true);
      try {
        const available = healthService.isAvailable();
        setHealthAvailable(available);
        
        if (available) {
          const healthWeight = await healthService.getLatestWeight();
          if (healthWeight && healthWeight > 0) {
            setWeight(healthWeight);
            setInputValue(healthWeight.toFixed(1));
          }
        }
      } catch (err) {
        console.error("Failed to load weight from Health:", err);
      } finally {
        setLoadingHealth(false);
      }
    }
    
    loadHealthWeight();
  }, [targetLog?.currentWeight]);

  if (!challenge || !targetLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const goal = challenge.weightGoal ?? 0;

  const handleInputChange = (text: string) => {
    // Allow decimal input
    const cleaned = text.replace(/[^0-9.]/g, "");
    // Ensure only one decimal point
    const parts = cleaned.split(".");
    const formatted = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("") 
      : cleaned;
    
    setInputValue(formatted);
    const num = parseFloat(formatted);
    if (!isNaN(num) && num >= 0) {
      setWeight(num);
    } else if (formatted === "" || formatted === ".") {
      setWeight(0);
    }
  };

  const handleQuickAdjust = (amount: number) => {
    const newWeight = Math.max(0, weight + amount);
    setWeight(newWeight);
    setInputValue(newWeight.toFixed(1));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to Apple Health using new healthSyncService
      if (Platform.OS === "ios" && weight > 0) {
        try {
          const result = await healthSyncService.saveWeight(weight);
          if (!result) {
            captureMessage(`Weight sync to Apple Health returned false for: ${weight}kg`, "warning");
          }
        } catch (healthError: any) {
          console.error("Error saving to HealthKit:", healthError);
          captureException(new Error(`Apple Health weight sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
            weight,
            platform: Platform.OS,
          });
        }
      }
      
      if (isEditingPastDay && logIdParam) {
        await updateDailyLog(logIdParam, {
          currentWeight: weight,
          weightLogged: true,
        });
        
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const existingLogs = await getActivityLogsForDate(challenge.$id!, dateStr, 'weight');
        const activityData = {
          userId: challenge.userId,
          challengeId: challenge.$id!,
          type: 'weight' as const,
          title: "Weight Logged",
          description: `⚖️ Current weight: ${weight.toFixed(1)}kg`,
          value: weight,
          unit: "kg",
          date: dateStr,
        };
        
        if (existingLogs.length > 0) {
          await updateActivityLog(existingLogs[0].$id!, activityData);
        } else {
          await createActivityLog(activityData);
        }
        
        await fetchAllLogs(challenge.$id!);
      } else {
        await updateProgress({
          currentWeight: weight,
          weightLogged: true,
        });

        const { logActivity } = useChallengeStore.getState();
        await logActivity({
          type: "weight",
          title: "Weight Logged",
          description: `⚖️ Current weight: ${weight.toFixed(1)}kg`,
          value: weight,
          unit: "kg",
        });
      }

      router.back();
    } catch (err) {
      console.error("Failed to save weight:", err);
      captureException(new Error(`Failed to save weight: ${err instanceof Error ? err.message : JSON.stringify(err)}`), {
        weight,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWeight = async () => {
    setSaving(true);
    try {
      // Note: HealthKit doesn't allow third-party apps to delete data
      // We can only clear the data saved by our app in Appwrite
      await updateProgress({
        currentWeight: 0,
        weightLogged: false,
      });
      router.back();
    } catch (err) {
      console.error("Failed to remove weight:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-indigo-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-indigo-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 bg-indigo-100 rounded-full">
          <Feather name="arrow-left" size={24} color="#6366F1" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Log Weight</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-6">
          {/* Scale Display */}
          <View className="items-center mb-8">
            <View className="h-16 w-16 rounded-full bg-indigo-100 items-center justify-center mb-4">
              <Feather name="trending-down" size={32} color="#6366F1" />
            </View>
            {loadingHealth ? (
              <View className="items-center justify-center h-40">
                <ActivityIndicator size="large" color="#6366F1" />
                <Text className="text-sm text-gray-500 mt-2">Loading from Apple Health...</Text>
              </View>
            ) : (
              <ScaleDisplay weight={weight} goal={goal} />
            )}
            
            {/* Apple Health indicator */}
            {Platform.OS === "ios" && healthAvailable && !loadingHealth && (
              <View className="mt-3 flex-row items-center bg-red-50 px-3 py-1.5 rounded-full">
                <Feather name="heart" size={14} color="#EF4444" />
                <Text className="ml-1.5 text-xs text-red-600 font-medium">
                  Syncs with Apple Health
                </Text>
              </View>
            )}
          </View>

          {/* Weight Input */}
          <View className="bg-white rounded-2xl p-6 shadow-sm mb-6 border border-indigo-100">
            <Text className="text-sm font-semibold text-indigo-700 mb-4 text-center">
              Enter Today's Weight
            </Text>
            
            <View className="flex-row items-center justify-center mb-4">
              <Pressable
                onPress={() => handleQuickAdjust(-0.1)}
                className="bg-indigo-100 h-14 w-14 rounded-full items-center justify-center"
              >
                <Feather name="minus" size={24} color="#6366F1" />
              </Pressable>
              
              <View className="mx-4 items-center">
                <TextInput
                  value={inputValue}
                  onChangeText={handleInputChange}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#9CA3AF"
                  className="text-5xl font-bold text-gray-800 w-32 text-center h-16"
                  maxLength={5}
                />
                <Text className="text-lg text-gray-400 mt-1">kg</Text>
              </View>
              
              <Pressable
                onPress={() => handleQuickAdjust(0.1)}
                className="bg-indigo-100 h-14 w-14 rounded-full items-center justify-center"
              >
                <Feather name="plus" size={24} color="#6366F1" />
              </Pressable>
            </View>

            {/* Fine adjustment buttons */}
            <View className="flex-row justify-center gap-3">
              <Pressable
                onPress={() => handleQuickAdjust(-1)}
                className="bg-indigo-50 px-4 py-2 rounded-lg"
              >
                <Text className="text-sm text-indigo-600 font-medium">-1 kg</Text>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAdjust(-0.5)}
                className="bg-indigo-50 px-4 py-2 rounded-lg"
              >
                <Text className="text-sm text-indigo-600 font-medium">-0.5 kg</Text>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAdjust(0.5)}
                className="bg-indigo-50 px-4 py-2 rounded-lg"
              >
                <Text className="text-sm text-indigo-600 font-medium">+0.5 kg</Text>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAdjust(1)}
                className="bg-indigo-50 px-4 py-2 rounded-lg"
              >
                <Text className="text-sm text-indigo-600 font-medium">+1 kg</Text>
              </Pressable>
            </View>
          </View>

          {/* Goal Info */}
          {goal > 0 && (
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-3">Your Goal</Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="h-10 w-10 bg-indigo-100 rounded-full items-center justify-center">
                    <Feather name="target" size={20} color="#6366F1" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-lg font-bold text-gray-800">{goal} kg</Text>
                    <Text className="text-xs text-gray-500">Target weight</Text>
                  </View>
                </View>
                <TrendIndicator current={weight} previous={targetLog.currentWeight} />
              </View>
            </View>
          )}

          {/* Tips */}
          <View className="bg-indigo-50 rounded-2xl p-4 mb-6">
            <View className="flex-row items-center mb-2">
              <Feather name="info" size={16} color="#4338CA" />
              <Text className="text-sm font-semibold text-indigo-800 ml-2">Weighing Tip</Text>
            </View>
            <Text className="text-sm text-indigo-700">
              For the most accurate tracking, weigh yourself at the same time each day, 
              preferably in the morning before eating.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={saving || weight === 0}
          className={`py-4 rounded-2xl items-center mb-3 ${
            saving || weight === 0 ? "bg-gray-300" : "bg-indigo-500"
          }`}
        >
          <Text className="text-white font-bold text-lg">
            {saving ? "Saving..." : "Save Weight"}
          </Text>
        </Pressable>

        {/* Remove Weight Button - only show if weight exists */}
        {targetLog.weightLogged && targetLog.currentWeight > 0 && (
          <Pressable
            onPress={handleRemoveWeight}
            disabled={saving}
            className="py-3 rounded-2xl items-center border-2 border-red-500"
          >
            <View className="flex-row items-center">
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text className="text-red-500 font-semibold text-base ml-2">
                Remove Weight Entry
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
