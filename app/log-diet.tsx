import { healthSyncService } from "@/lib/healthSync";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Meal type definition
type MealData = {
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks: string;
};

type MealCalories = {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
};

// Parse meals from JSON string
function parseMeals(mealsString?: string): MealData {
  if (!mealsString) {
    return { breakfast: "", lunch: "", dinner: "", snacks: "" };
  }
  try {
    return JSON.parse(mealsString);
  } catch {
    // Legacy: if it's not JSON, treat it as general notes
    return { breakfast: "", lunch: "", dinner: "", snacks: mealsString };
  }
}

// Serialize meals to JSON string
function serializeMeals(meals: MealData): string {
  return JSON.stringify(meals);
}

// Meal card component
type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

const MEAL_CONFIG: Record<MealType, { icon: keyof typeof Feather.glyphMap; label: string; time: string; color: string; bgColor: string }> = {
  breakfast: { 
    icon: "sunrise", 
    label: "Breakfast", 
    time: "Morning",
    color: "#F97316",
    bgColor: "bg-orange-50"
  },
  lunch: { 
    icon: "sun", 
    label: "Lunch", 
    time: "Midday",
    color: "#EAB308",
    bgColor: "bg-yellow-50"
  },
  dinner: { 
    icon: "moon", 
    label: "Dinner", 
    time: "Evening",
    color: "#8B5CF6",
    bgColor: "bg-purple-50"
  },
  snacks: { 
    icon: "coffee", 
    label: "Snacks", 
    time: "Anytime",
    color: "#22C55E",
    bgColor: "bg-green-50"
  },
};

function MealCard({ 
  type, 
  value, 
  onChange,
  isExpanded,
  onToggle,
  showCalories,
  calories,
  onCaloriesChange,
}: { 
  type: MealType; 
  value: string; 
  onChange: (text: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  showCalories?: boolean;
  calories?: number;
  onCaloriesChange?: (value: number) => void;
}) {
  const config = MEAL_CONFIG[type];
  const hasContent = value.trim().length > 0;
  const hasCalories = (calories ?? 0) > 0;

  return (
    <View className={`${config.bgColor} rounded-2xl mb-3 overflow-hidden`}>
      <Pressable 
        onPress={onToggle}
        className="flex-row items-center justify-between p-4"
      >
        <View className="flex-row items-center flex-1">
          <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: config.color + "20" }}>
            <Feather name={config.icon} size={20} color={config.color} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-800">{config.label}</Text>
            <Text className="text-xs text-gray-500">
              {config.time}
              {showCalories && hasCalories && ` • ${calories} cal`}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center">
          {(hasContent || hasCalories) && !isExpanded && (
            <View className="bg-green-500 h-6 w-6 rounded-full items-center justify-center mr-2">
              <Feather name="check" size={14} color="white" />
            </View>
          )}
          <Feather 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#6B7280" 
          />
        </View>
      </Pressable>
      
      {isExpanded && (
        <View className="px-4 pb-4">
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={`What did you have for ${config.label.toLowerCase()}?`}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            className="bg-white rounded-xl p-3 text-gray-800 min-h-[80px]"
            style={{ textAlignVertical: "top" }}
          />
          
          {showCalories && onCaloriesChange && (
            <View className="mt-3 bg-white rounded-xl p-3">
              <Text className="text-xs text-gray-500 mb-2">Calories</Text>
              <View className="flex-row items-center">
                <TextInput
                  value={calories?.toString() || ""}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    onCaloriesChange(num);
                  }}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  className="flex-1 text-2xl font-bold text-gray-800"
                />
                <Text className="text-gray-500 ml-2">cal</Text>
              </View>
              <View className="flex-row flex-wrap gap-2 mt-2">
                {[100, 200, 300, 500].map((cal) => (
                  <Pressable
                    key={cal}
                    onPress={() => onCaloriesChange((calories ?? 0) + cal)}
                    className="bg-gray-100 px-3 py-1 rounded-full"
                  >
                    <Text className="text-xs text-gray-600">+{cal}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          
          {hasContent && (
            <View className="flex-row items-center mt-2">
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text className="text-xs text-green-600 ml-1">Logged</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// Diet completion indicator
function DietProgressRing({ mealsLogged, totalMeals }: { mealsLogged: number; totalMeals: number }) {
  return (
    <View className="items-center">
      <View className="flex-row">
        {Array.from({ length: totalMeals }).map((_, index) => (
          <View
            key={index}
            className={`h-3 w-3 rounded-full mx-1 ${
              index < mealsLogged ? "bg-green-500" : "bg-gray-200"
            }`}
          />
        ))}
      </View>
      <Text className="text-xs text-gray-500 mt-2">
        {mealsLogged} of {totalMeals} meals logged
      </Text>
    </View>
  );
}

export default function LogDietScreen() {
  const { challenge, todayLog, updateProgress } = useChallengeStore();
  const [meals, setMeals] = useState<MealData>(() => parseMeals(todayLog?.meals));
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>("breakfast");
  const [saving, setSaving] = useState(false);
  const [dietCompleted, setDietCompleted] = useState(todayLog?.dietCompleted ?? false);
  const [mealCalories, setMealCalories] = useState<MealCalories>(() => {
    try {
      if (todayLog?.calorieDetails) {
        const parsed = JSON.parse(todayLog.calorieDetails);
        return {
          breakfast: parsed.breakfast || 0,
          lunch: parsed.lunch || 0,
          dinner: parsed.dinner || 0,
          snacks: parsed.snacks || 0,
        };
      }
    } catch {}
    return { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
  });

  const trackCalories = challenge?.trackCalories ?? false;

  // Update meals when todayLog changes
  useEffect(() => {
    if (todayLog?.meals) {
      setMeals(parseMeals(todayLog.meals));
    }
    setDietCompleted(todayLog?.dietCompleted ?? false);
    
    // Update calories if tracking
    if (todayLog?.calorieDetails) {
      try {
        const parsed = JSON.parse(todayLog.calorieDetails);
        setMealCalories({
          breakfast: parsed.breakfast || 0,
          lunch: parsed.lunch || 0,
          dinner: parsed.dinner || 0,
          snacks: parsed.snacks || 0,
        });
      } catch {}
    }
  }, [todayLog?.meals, todayLog?.dietCompleted, todayLog?.calorieDetails]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const handleMealChange = (type: MealType, text: string) => {
    setMeals((prev) => ({ ...prev, [type]: text }));
  };

  const handleCalorieChange = (type: MealType, value: number) => {
    setMealCalories((prev) => ({ ...prev, [type]: value }));
  };

  const toggleExpanded = (type: MealType) => {
    setExpandedMeal((prev) => (prev === type ? null : type));
  };

  const mealsLogged = Object.values(meals).filter((m) => m.trim().length > 0).length;
  const allMealsLogged = mealsLogged === 4;
  const totalCalories = mealCalories.breakfast + mealCalories.lunch + mealCalories.dinner + mealCalories.snacks;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        meals: serializeMeals(meals),
        dietCompleted: dietCompleted,
      };
      
      // Save calories if tracking is enabled
      if (trackCalories) {
        updates.caloriesConsumed = totalCalories;
        updates.calorieDetails = JSON.stringify(mealCalories);
      }
      
      await updateProgress(updates);
      
      // Sync calories to Apple Health using new service
      if (trackCalories && totalCalories > 0) {
        try {
          // Save total daily calories
          await healthSyncService.saveCalories(totalCalories, new Date(), "Daily Total");
        } catch (healthError) {
          console.log("HealthKit calorie sync skipped:", healthError);
        }
      }

      // Log activity to feed
      const { logActivity } = useChallengeStore.getState();
      await logActivity({
        type: "diet",
        title: "Diet Logged",
        description: `${mealsLogged} meal${mealsLogged !== 1 ? 's' : ''} logged${trackCalories ? ` - ${totalCalories} calories` : ""}${dietCompleted ? " ✓ Diet followed!" : ""}`,
        value: totalCalories,
        unit: trackCalories ? "calories" : undefined,
      });
      
      router.back();
    } catch (err) {
      console.error("Failed to save diet:", err);
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
        <Text className="text-lg font-bold text-gray-900">Log Diet</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-4 pt-6">
            {/* Header Section */}
            <View className="items-center mb-6">
              <View className="h-20 w-20 rounded-full bg-green-100 items-center justify-center mb-3">
                <Feather name="edit-3" size={40} color="#22C55E" />
              </View>
              <Text className="text-xl font-bold text-gray-800">Today's Meals</Text>
              <View className="mt-3">
                <DietProgressRing mealsLogged={mealsLogged} totalMeals={4} />
              </View>
            </View>

            {/* Diet Compliance Toggle */}
            <Pressable
              onPress={() => setDietCompleted(!dietCompleted)}
              className={`flex-row items-center justify-between p-4 rounded-2xl mb-4 ${
                dietCompleted ? "bg-green-100" : "bg-white"
              } shadow-sm`}
            >
              <View className="flex-row items-center flex-1">
                <View className={`h-12 w-12 rounded-full items-center justify-center ${
                  dietCompleted ? "bg-green-500" : "bg-gray-100"
                }`}>
                  <Feather 
                    name={dietCompleted ? "check" : "x"} 
                    size={24} 
                    color={dietCompleted ? "white" : "#6B7280"} 
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text className={`text-base font-semibold ${
                    dietCompleted ? "text-green-800" : "text-gray-800"
                  }`}>
                    Followed my diet plan
                  </Text>
                  <Text className={`text-xs ${
                    dietCompleted ? "text-green-600" : "text-gray-500"
                  }`}>
                    {dietCompleted 
                      ? "Great job staying on track!" 
                      : "Tap to mark as complete"}
                  </Text>
                </View>
              </View>
              <View className={`h-8 w-8 rounded-full items-center justify-center ${
                dietCompleted ? "bg-green-500" : "bg-gray-200"
              }`}>
                {dietCompleted && <Feather name="check" size={16} color="white" />}
              </View>
            </Pressable>

            {/* Meal Cards */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-3 ml-1">
                Log Your Meals (Optional)
              </Text>
              
              {(Object.keys(MEAL_CONFIG) as MealType[]).map((type) => (
                <MealCard
                  key={type}
                  type={type}
                  value={meals[type]}
                  onChange={(text) => handleMealChange(type, text)}
                  isExpanded={expandedMeal === type}
                  onToggle={() => toggleExpanded(type)}
                  showCalories={trackCalories}
                  calories={mealCalories[type]}
                  onCaloriesChange={(value) => handleCalorieChange(type, value)}
                />
              ))}
            </View>

            {/* Calorie Summary */}
            {trackCalories && totalCalories > 0 && (
              <View className="bg-emerald-50 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Feather name="pie-chart" size={20} color="#065F46" style={{ marginRight: 8 }} />
                    <Text className="text-sm font-semibold text-emerald-800">Today's Calories</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-2xl font-bold text-emerald-700">{totalCalories}</Text>
                    {challenge?.caloriesGoal && (
                      <Text className="text-xs text-emerald-600">
                        of {challenge.caloriesGoal} goal
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Motivation */}
            <View className="bg-green-50 rounded-2xl p-4 mb-6">
              <View className="flex-row items-center mb-2">
                <Feather name="info" size={16} color="#166534" />
                <Text className="text-sm font-semibold text-green-800 ml-2">Diet Tip</Text>
              </View>
              <Text className="text-sm text-green-700">
                {!dietCompleted
                  ? "Focus on whole foods and stay hydrated. You've got this!"
                  : allMealsLogged
                    ? "Amazing! You've logged all your meals. Keep up the great work!"
                    : "Great job following your diet! Consider logging your meals for better tracking."}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="px-4 pb-6 bg-gray-50">
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`py-4 rounded-2xl items-center ${
              saving ? "bg-gray-300" : "bg-green-500"
            }`}
          >
            <Text className="text-white font-bold text-lg">
              {saving ? "Saving..." : "Save Diet Log"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
