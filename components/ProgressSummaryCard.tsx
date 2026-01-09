import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { Text, View } from "react-native";

function ProgressRow({ label, current, goal, unit }: { label: string; current: number; goal: number; unit?: string }) {
  const safeGoal = goal > 0 ? goal : 0;
  const percent = safeGoal > 0 ? Math.min(100, Math.round((current / safeGoal) * 100)) : 0;
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-gray-700">{label}</Text>
        <Text className="text-sm text-gray-700">{current}{unit ? ` ${unit}` : ""}{safeGoal ? ` / ${safeGoal}${unit ? ` ${unit}` : ""}` : ""}</Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View style={{ width: `${percent}%` }} className="h-2 bg-violet-500 rounded-full" />
      </View>
    </View>
  );
}

export default function ProgressSummaryCard() {
  const { challenge, todayLog } = useChallengeStore();
  const { steps: liveSteps, workouts: liveWorkouts, isAuthorized: healthAuthorized } = useHealthStore();

  if (!challenge || !todayLog) return null;

  // Use live Apple Health data if available, otherwise fall back to logged data
  const useHealthKit = Platform.OS === "ios" && healthAuthorized;
  const currentSteps = useHealthKit ? Math.round(liveSteps) : (todayLog.stepsCount ?? 0);
  
  // Calculate workout minutes from live health data
  const liveOutdoorMinutes = useHealthKit 
    ? Math.round(liveWorkouts.filter(w => w.isOutdoor).reduce((sum, w) => sum + w.duration, 0))
    : (todayLog.workout1Minutes ?? 0);
  const liveIndoorMinutes = useHealthKit
    ? Math.round(liveWorkouts.filter(w => !w.isOutdoor).reduce((sum, w) => sum + w.duration, 0))
    : (todayLog.workout2Minutes ?? 0);

  const exerciseItems: JSX.Element[] = [];
  const nutritionItems: JSX.Element[] = [];
  const habitBools: Array<{ key: keyof typeof todayLog; label: string; value?: boolean }> = [];

  // Exercise group
  if (challenge.trackSteps) {
    exerciseItems.push(
      <ProgressRow key="steps" label="Steps" current={currentSteps} goal={challenge.stepsGoal ?? 0} unit="steps" />
    );
  }
  if (challenge.trackWorkout1) {
    exerciseItems.push(
      <ProgressRow key="w1" label="Outdoor Workout" current={liveOutdoorMinutes} goal={challenge.workoutMinutes ?? 0} unit="min" />
    );
  }
  if (challenge.trackWorkout2) {
    exerciseItems.push(
      <ProgressRow key="w2" label="Second Workout" current={liveIndoorMinutes} goal={challenge.workoutMinutes ?? 0} unit="min" />
    );
  }

  // Nutrition group
  if (challenge.trackWater) {
    nutritionItems.push(
      <ProgressRow key="water" label="Water" current={todayLog.waterLiters ?? 0} goal={challenge.waterLiters ?? 0} unit="L" />
    );
  }
  if ((challenge as any).trackCalories) {
    nutritionItems.push(
      <ProgressRow key="calories" label="Calories" current={todayLog.caloriesConsumed ?? 0} goal={challenge.caloriesGoal ?? 0} unit="kcal" />
    );
  }
  if (challenge.trackWeight) {
    const current = todayLog.currentWeight ?? 0;
    const goal = challenge.weightGoal ?? 0;
    const delta = current && goal ? (current - goal) : 0;
    nutritionItems.push(
      <View key="weight" className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm text-gray-700">Weight</Text>
        <Text className="text-sm text-gray-700">{current} kg {goal ? `(goal ${goal} kg${delta ? `, ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg` : ""})` : ""}</Text>
      </View>
    );
  }

  // Habits group (booleans)
  if (challenge.trackDiet) habitBools.push({ key: "dietCompleted", label: "Diet", value: todayLog.dietCompleted });
  if (challenge.trackProgressPhoto) habitBools.push({ key: "progressPhotoCompleted", label: "Photo", value: todayLog.progressPhotoCompleted });
  if (challenge.trackNoAlcohol) habitBools.push({ key: "noAlcoholCompleted", label: "No Alcohol", value: todayLog.noAlcoholCompleted });

  const hasAny = exerciseItems.length + nutritionItems.length + habitBools.length > 0;

  return (
    <View className="bg-white rounded-2xl p-6 mt-2 shadow-sm">
      <View className="flex-row items-center mb-3">
        <Feather name="bar-chart-2" size={16} color="#6B7280" />
        <Text className="text-sm font-semibold text-gray-700 ml-2">Today's Progress</Text>
      </View>

      {!hasAny && (
        <Text className="text-sm text-gray-500">No tracked goals configured.</Text>
      )}

      {exerciseItems.length > 0 && (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Feather name="activity" size={14} color="#6B7280" />
            <Text className="text-xs font-semibold text-gray-600 ml-2">Exercise</Text>
          </View>
          {exerciseItems}
        </View>
      )}

      {nutritionItems.length > 0 && (
        <View className="mb-2">
          <View className="flex-row items-center mb-2">
            <Feather name="droplet" size={14} color="#6B7280" />
            <Text className="text-xs font-semibold text-gray-600 ml-2">Nutrition & Weight</Text>
          </View>
          {nutritionItems}
        </View>
      )}

      {habitBools.length > 0 && (
        <View className="mt-2">
          <View className="flex-row items-center mb-2">
            <Feather name="check-circle" size={14} color="#6B7280" />
            <Text className="text-xs font-semibold text-gray-600 ml-2">Habits</Text>
          </View>
          <View className="flex-row flex-wrap">
            {habitBools.map((b) => (
              <View key={String(b.key)} className="mr-3 mb-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: b.value ? "#DCFCE7" : "#F3F4F6" }}>
                <Text style={{ color: b.value ? "#166534" : "#374151" }} className="text-xs font-semibold">
                  {b.label}: {b.value ? "Done" : "Pending"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
