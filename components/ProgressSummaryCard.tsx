import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
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

  if (!challenge || !todayLog) return null;

  const items: JSX.Element[] = [];

  // Steps
  if (challenge.trackSteps) {
    items.push(
      <ProgressRow key="steps" label="Steps" current={todayLog.stepsCount ?? 0} goal={challenge.stepsGoal ?? 0} unit="steps" />
    );
  }

  // Outdoor workout
  if (challenge.trackWorkout1) {
    items.push(
      <ProgressRow key="w1" label="Outdoor Workout" current={todayLog.workout1Minutes ?? 0} goal={challenge.workoutMinutes ?? 0} unit="min" />
    );
  }

  // Second workout
  if (challenge.trackWorkout2) {
    items.push(
      <ProgressRow key="w2" label="Second Workout" current={todayLog.workout2Minutes ?? 0} goal={challenge.workoutMinutes ?? 0} unit="min" />
    );
  }

  // Water
  if (challenge.trackWater) {
    items.push(
      <ProgressRow key="water" label="Water" current={todayLog.waterLiters ?? 0} goal={challenge.waterLiters ?? 0} unit="L" />
    );
  }

  // Reading
  if (challenge.trackReading) {
    items.push(
      <ProgressRow key="reading" label="Reading" current={todayLog.readingPages ?? 0} goal={challenge.readingPages ?? 0} unit="pages" />
    );
  }

  // Calories
  if (challenge.trackDiet) {
    items.push(
      <ProgressRow key="calories" label="Calories" current={todayLog.caloriesConsumed ?? 0} goal={challenge.caloriesGoal ?? 0} unit="kcal" />
    );
  }

  // Weight (show simple current vs goal text)
  if (challenge.trackWeight) {
    const current = todayLog.currentWeight ?? 0;
    const goal = challenge.weightGoal ?? 0;
    const delta = current && goal ? (current - goal) : 0;
    items.push(
      <View key="weight" className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm text-gray-700">Weight</Text>
        <Text className="text-sm text-gray-700">{current} kg {goal ? `(goal ${goal} kg${delta ? `, ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg` : ""})` : ""}</Text>
      </View>
    );
  }

  // Booleans summary (diet/photo/no alcohol)
  const bools: Array<{ key: keyof typeof todayLog; label: string; value?: boolean }> = [];
  if (challenge.trackDiet) bools.push({ key: "dietCompleted", label: "Diet", value: todayLog.dietCompleted });
  if (challenge.trackProgressPhoto) bools.push({ key: "progressPhotoCompleted", label: "Photo", value: todayLog.progressPhotoCompleted });
  if (challenge.trackNoAlcohol) bools.push({ key: "noAlcoholCompleted", label: "No Alcohol", value: todayLog.noAlcoholCompleted });

  return (
    <View className="bg-white rounded-2xl p-6 mt-2 shadow-sm">
      <View className="flex-row items-center mb-3">
        <Feather name="bar-chart-2" size={16} color="#6B7280" />
        <Text className="text-sm font-semibold text-gray-700 ml-2">Today's Progress</Text>
      </View>

      {items.length > 0 ? items : (
        <Text className="text-sm text-gray-500">No tracked goals configured.</Text>
      )}

      {bools.length > 0 && (
        <View className="mt-3 flex-row flex-wrap">
          {bools.map((b) => (
            <View key={String(b.key)} className="mr-3 mb-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: b.value ? "#DCFCE7" : "#F3F4F6" }}>
              <Text style={{ color: b.value ? "#166534" : "#374151" }} className="text-xs font-semibold">
                {b.label}: {b.value ? "Done" : "Pending"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
