import { healthService } from "@/lib/health";
import { captureException } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Meal calorie entry
type MealCalories = {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
};

// Quick add calorie amounts
const QUICK_ADD_OPTIONS = [100, 200, 300, 500];

// Circular progress for calorie display
function CalorieRing({ 
  current, 
  goal, 
  size = 120 
}: { 
  current: number; 
  goal: number; 
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const isOver = current > goal;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
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
          stroke={isOver ? "#EF4444" : "#10B981"}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center">
        <Text className={`text-2xl font-bold ${isOver ? "text-red-600" : "text-gray-800"}`}>
          {current}
        </Text>
        <Text className="text-xs text-gray-500">of {goal}</Text>
      </View>
    </View>
  );
}

// Meal calorie input card
function MealCalorieCard({
  meal,
  icon,
  label,
  calories,
  onCaloriesChange,
  bgColor,
  color,
}: {
  meal: keyof MealCalories;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  calories: number;
  onCaloriesChange: (value: number) => void;
  bgColor: string;
  color: string;
}) {
  const [inputValue, setInputValue] = useState(calories > 0 ? String(calories) : "");

  useEffect(() => {
    setInputValue(calories > 0 ? String(calories) : "");
  }, [calories]);

  const handleChange = (text: string) => {
    setInputValue(text);
    const num = parseInt(text, 10);
    onCaloriesChange(isNaN(num) ? 0 : num);
  };

  const handleQuickAdd = (amount: number) => {
    const newValue = calories + amount;
    setInputValue(String(newValue));
    onCaloriesChange(newValue);
  };

  return (
    <View className={`${bgColor} rounded-xl p-4 mb-3`}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="h-8 w-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: color + "20" }}>
            <Feather name={icon} size={16} color={color} />
          </View>
          <Text className="text-base font-semibold text-gray-800">{label}</Text>
        </View>
        <View className="flex-row items-center bg-white rounded-lg px-3 py-2">
          <TextInput
            value={inputValue}
            onChangeText={handleChange}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            className="text-right min-w-[60px] text-base font-semibold text-gray-800"
            style={{ padding: 0 }}
          />
          <Text className="text-sm text-gray-500 ml-1">cal</Text>
        </View>
      </View>
      <View className="flex-row">
        {QUICK_ADD_OPTIONS.map((amount) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickAdd(amount)}
            className="bg-white/60 rounded-full px-3 py-1 mr-2"
          >
            <Text className="text-xs font-medium text-gray-600">+{amount}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const MEAL_CONFIG: Record<keyof MealCalories, { icon: keyof typeof Feather.glyphMap; label: string; bgColor: string; color: string }> = {
  breakfast: { icon: "sunrise", label: "Breakfast", bgColor: "bg-orange-50", color: "#F97316" },
  lunch: { icon: "sun", label: "Lunch", bgColor: "bg-yellow-50", color: "#EAB308" },
  dinner: { icon: "moon", label: "Dinner", bgColor: "bg-purple-50", color: "#8B5CF6" },
  snacks: { icon: "coffee", label: "Snacks", bgColor: "bg-green-50", color: "#22C55E" },
};

export default function LogCaloriesScreen() {
  const router = useRouter();
  const { challenge, todayLog, updateProgress } = useChallengeStore();
  const [mealCalories, setMealCalories] = useState<MealCalories>({
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snacks: 0,
  });
  const [saving, setSaving] = useState(false);

  // Load existing calorie data
  useEffect(() => {
    if (todayLog?.calorieDetails) {
      try {
        const parsed = JSON.parse(todayLog.calorieDetails);
        setMealCalories({
          breakfast: parsed.breakfast ?? 0,
          lunch: parsed.lunch ?? 0,
          dinner: parsed.dinner ?? 0,
          snacks: parsed.snacks ?? 0,
        });
      } catch {
        // If no detailed data, use total
        if (todayLog.caloriesConsumed) {
          setMealCalories({
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            snacks: todayLog.caloriesConsumed,
          });
        }
      }
    }
  }, [todayLog?.calorieDetails, todayLog?.caloriesConsumed]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const totalCalories = mealCalories.breakfast + mealCalories.lunch + mealCalories.dinner + mealCalories.snacks;
  const calorieGoal = challenge.caloriesGoal ?? 2000;
  const remaining = calorieGoal - totalCalories;
  const isUnderGoal = totalCalories <= calorieGoal;

  const updateMealCalories = (meal: keyof MealCalories, value: number) => {
    setMealCalories((prev) => ({ ...prev, [meal]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProgress({
        caloriesConsumed: totalCalories,
        calorieDetails: JSON.stringify(mealCalories),
      });
      
      // Sync to Apple Health
      if (healthService.isAvailable()) {
        try {
          await healthService.saveMealCalories(mealCalories);
        } catch (healthError: any) {
          console.error("Error saving calories to HealthKit:", healthError);
          const totalCalories = mealCalories.breakfast + mealCalories.lunch + mealCalories.dinner + mealCalories.snacks;
          captureException(new Error(`Apple Health calories sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
            totalCalories,
          });
        }
      }
      
      router.back();
    } catch (err) {
      console.error("Failed to save calories:", err);
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
        <Text className="text-lg font-bold text-gray-900">Log Calories</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View className="p-4">
            {/* Calorie Summary Card */}
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-sm text-gray-500 mb-1">Today's Calories</Text>
                  <Text className={`text-3xl font-bold ${isUnderGoal ? "text-gray-800" : "text-red-600"}`}>
                    {totalCalories}
                  </Text>
                  <Text className="text-sm text-gray-500">of {calorieGoal} goal</Text>
                  
                  <View className={`mt-3 rounded-lg px-3 py-2 self-start ${isUnderGoal ? "bg-green-50" : "bg-red-50"}`}>
                    <Text className={`text-sm font-semibold ${isUnderGoal ? "text-green-700" : "text-red-700"}`}>
                      {isUnderGoal 
                        ? `${remaining} cal remaining` 
                        : `${Math.abs(remaining)} cal over`}
                    </Text>
                  </View>
                </View>
                <CalorieRing current={totalCalories} goal={calorieGoal} />
              </View>
            </View>

            {/* Meal Breakdown */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-3 ml-1">
                Log by Meal
              </Text>
              {(Object.keys(MEAL_CONFIG) as (keyof MealCalories)[]).map((meal) => (
                <MealCalorieCard
                  key={meal}
                  meal={meal}
                  icon={MEAL_CONFIG[meal].icon}
                  label={MEAL_CONFIG[meal].label}
                  calories={mealCalories[meal]}
                  onCaloriesChange={(value) => updateMealCalories(meal, value)}
                  bgColor={MEAL_CONFIG[meal].bgColor}
                  color={MEAL_CONFIG[meal].color}
                />
              ))}
            </View>

            {/* Tip Card */}
            <View className="bg-emerald-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <Feather name="info" size={20} color="#065F46" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-emerald-800 mb-1">
                    Calorie Tracking Tip
                  </Text>
                  <Text className="text-xs text-emerald-700">
                    Logging by meal helps you identify eating patterns and make 
                    better food choices throughout the day.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 border-t border-gray-100">
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`py-4 rounded-2xl items-center ${isUnderGoal ? "bg-emerald-500" : "bg-red-500"}`}
          >
            {saving ? (
              <Text className="text-white font-semibold">Saving...</Text>
            ) : (
              <View className="flex-row items-center">
                <Feather name="check" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Save {totalCalories} Calories
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
