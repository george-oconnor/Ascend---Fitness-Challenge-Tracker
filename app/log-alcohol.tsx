import { updateDailyLog } from "@/lib/appwrite";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Drink types with standard drink equivalents
type DrinkType = {
  id: string;
  emoji: string;
  label: string;
  standardDrinks: number; // Standard drinks per serving
  description: string;
};

const DRINK_TYPES: DrinkType[] = [
  { id: "beer", emoji: "🍺", label: "Beer", standardDrinks: 1, description: "Pint / 568ml" },
  { id: "wine", emoji: "🍷", label: "Wine", standardDrinks: 1.5, description: "Glass / 175ml" },
  { id: "spirits", emoji: "🥃", label: "Spirits", standardDrinks: 1, description: "Shot / 25ml" },
  { id: "cocktail", emoji: "🍹", label: "Cocktail", standardDrinks: 2, description: "Mixed drink" },
  { id: "cider", emoji: "🍏", label: "Cider", standardDrinks: 1, description: "Pint / 568ml" },
  { id: "champagne", emoji: "🥂", label: "Champagne", standardDrinks: 1.5, description: "Flute / 125ml" },
];

type DrinkEntry = {
  drinkId: string;
  count: number;
};

// Parse alcohol details from JSON string
function parseAlcoholDetails(detailsString?: string): { drinks: DrinkEntry[]; notes: string } {
  if (!detailsString) {
    return { drinks: [], notes: "" };
  }
  try {
    return JSON.parse(detailsString);
  } catch {
    return { drinks: [], notes: "" };
  }
}

// Serialize alcohol details to JSON string
function serializeAlcoholDetails(drinks: DrinkEntry[], notes: string): string {
  return JSON.stringify({ drinks, notes });
}

// Drink counter component
function DrinkCounter({
  drink,
  count,
  onIncrement,
  onDecrement,
}: {
  drink: DrinkType;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const hasCount = count > 0;

  return (
    <View className={`rounded-xl p-3 mb-2 flex-row items-center ${hasCount ? "bg-red-50" : "bg-gray-50"}`}>
      <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 ${hasCount ? "bg-red-100" : "bg-gray-200"}`}>
        <Text className="text-xl">{drink.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className={`text-base font-semibold ${hasCount ? "text-red-700" : "text-gray-800"}`}>
          {drink.label}
        </Text>
        <Text className="text-xs text-gray-500">{drink.description}</Text>
      </View>
      <View className="flex-row items-center">
        <Pressable
          onPress={onDecrement}
          disabled={count === 0}
          className={`h-8 w-8 rounded-full items-center justify-center ${
            count > 0 ? "bg-red-200" : "bg-gray-200"
          }`}
        >
          <Feather name="minus" size={18} color={count > 0 ? "#B91C1C" : "#9CA3AF"} />
        </Pressable>
        <Text className={`text-lg font-bold mx-4 min-w-[24px] text-center ${hasCount ? "text-red-700" : "text-gray-400"}`}>
          {count}
        </Text>
        <Pressable
          onPress={onIncrement}
          className="h-8 w-8 rounded-full items-center justify-center bg-red-500"
        >
          <Feather name="plus" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

export default function LogAlcoholScreen() {
  const router = useRouter();
  const { date: dateParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; logId?: string }>();
  const { challenge, todayLog, updateProgress, allLogs, fetchAllLogs } = useChallengeStore();
  
  // Determine which log we're editing
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [drinks, setDrinks] = useState<DrinkEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing data
  useEffect(() => {
    if (targetLog?.alcoholDetails) {
      const parsed = parseAlcoholDetails(targetLog.alcoholDetails);
      setDrinks(parsed.drinks);
      setNotes(parsed.notes);
    }
  }, [targetLog?.alcoholDetails]);

  if (!challenge || !targetLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const getDrinkCount = (drinkId: string): number => {
    const entry = drinks.find((d) => d.drinkId === drinkId);
    return entry?.count ?? 0;
  };

  const updateDrinkCount = (drinkId: string, delta: number) => {
    setDrinks((prev) => {
      const existing = prev.find((d) => d.drinkId === drinkId);
      if (existing) {
        const newCount = Math.max(0, existing.count + delta);
        if (newCount === 0) {
          return prev.filter((d) => d.drinkId !== drinkId);
        }
        return prev.map((d) => (d.drinkId === drinkId ? { ...d, count: newCount } : d));
      } else if (delta > 0) {
        return [...prev, { drinkId, count: delta }];
      }
      return prev;
    });
  };

  // Calculate totals
  const totalDrinks = drinks.reduce((sum, d) => sum + d.count, 0);
  const totalStandardDrinks = drinks.reduce((sum, d) => {
    const drinkType = DRINK_TYPES.find((dt) => dt.id === d.drinkId);
    return sum + d.count * (drinkType?.standardDrinks ?? 1);
  }, 0);

  const hadNoDrinks = totalDrinks === 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditingPastDay && logIdParam) {
        // Update specific past day's log
        console.log("Saving past day alcohol log:", { hadNoDrinks, totalDrinks });
        await updateDailyLog(logIdParam, {
          noAlcoholCompleted: hadNoDrinks,
          alcoholDetails: totalDrinks > 0 ? serializeAlcoholDetails(drinks, notes) : "",
        });
        
        console.log("Successfully saved past day log");
        
        // Log activity to feed for past day
        const { logActivity } = useChallengeStore.getState();
        if (hadNoDrinks) {
          await logActivity({
            type: "alcohol",
            title: "No Alcohol Logged",
            description: `✓ Stayed alcohol-free on ${format(targetDate, 'MMM d')}!`,
            date: format(targetDate, 'yyyy-MM-dd'),
          });
        } else {
          await logActivity({
            type: "alcohol",
            title: "Alcohol Logged",
            description: `${totalDrinks} drink${totalDrinks !== 1 ? 's' : ''} (${totalStandardDrinks.toFixed(1)} standard drinks) on ${format(targetDate, 'MMM d')}`,
            value: totalDrinks,
            unit: "drinks",
            date: format(targetDate, 'yyyy-MM-dd'),
          });
        }
        
        await fetchAllLogs();
      } else {
        // Update today's log
        await updateProgress({
          noAlcoholCompleted: hadNoDrinks,
          alcoholDetails: totalDrinks > 0 ? serializeAlcoholDetails(drinks, notes) : "",
        });

        // Log activity to feed
        const { logActivity } = useChallengeStore.getState();
        if (hadNoDrinks) {
          await logActivity({
            type: "alcohol",
            title: "No Alcohol Logged",
            description: "✓ Stayed alcohol-free today!",
          });
        } else {
          await logActivity({
            type: "alcohol",
            title: "Alcohol Logged",
            description: `${totalDrinks} drink${totalDrinks !== 1 ? 's' : ''} (${totalStandardDrinks.toFixed(1)} standard drinks)`,
            value: totalDrinks,
            unit: "drinks",
          });
        }
      }

      router.back();
    } catch (err) {
      console.error("Failed to save alcohol log:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSober = async () => {
    console.log("=== handleMarkSober called ===");
    console.log("isEditingPastDay:", isEditingPastDay);
    console.log("logIdParam:", logIdParam);
    console.log("targetLog:", targetLog);
    
    setSaving(true);
    try {
      // Clear all drinks and notes
      setDrinks([]);
      setNotes("");
      
      if (isEditingPastDay && logIdParam) {
        console.log("Updating past day log:", logIdParam, "to sober");
        await updateDailyLog(logIdParam, {
          noAlcoholCompleted: true,
          alcoholDetails: "", // Use empty string to clear the field in Appwrite
        });
        
        console.log("Successfully updated past day log");
        
        const { logActivity } = useChallengeStore.getState();
        await logActivity({
          type: "alcohol",
          title: "No Alcohol Logged",
          description: `✓ Stayed alcohol-free on ${format(targetDate, 'MMM d')}!`,
          date: format(targetDate, 'yyyy-MM-dd'),
        });
        
        await fetchAllLogs();
        console.log("Fetched all logs after update");
      } else {
        console.log("Updating today's log");
        await updateProgress({
          noAlcoholCompleted: true,
          alcoholDetails: "", // Use empty string to clear the field
        });

        // Log activity to feed
        const { logActivity } = useChallengeStore.getState();
        await logActivity({
          type: "alcohol",
          title: "No Alcohol Logged",
          description: "✓ Stayed alcohol-free today!",
        });
      }

      console.log("About to navigate back");
      router.back();
    } catch (err) {
      console.error("Failed to save alcohol update:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
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
        <Text className="text-lg font-bold text-gray-900">Log Alcohol</Text>
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
            {/* Status Header */}
            <View className={`rounded-2xl p-4 mb-4 flex-row items-center ${hadNoDrinks ? "bg-green-50" : "bg-red-50"}`}>
              <View className={`h-16 w-16 rounded-full items-center justify-center mr-4 ${hadNoDrinks ? "bg-green-100" : "bg-red-100"}`}>
                <Feather 
                  name={hadNoDrinks ? "check-circle" : "alert-circle"} 
                  size={32} 
                  color={hadNoDrinks ? "#15803D" : "#B91C1C"} 
                />
              </View>
              <View className="flex-1">
                <Text className={`text-lg font-bold ${hadNoDrinks ? "text-green-800" : "text-red-800"}`}>
                  {hadNoDrinks ? "Staying Sober Today!" : `${totalDrinks} Drink${totalDrinks !== 1 ? "s" : ""} Logged`}
                </Text>
                <Text className={`text-sm ${hadNoDrinks ? "text-green-600" : "text-red-600"}`}>
                  {hadNoDrinks 
                    ? "Great job sticking to the challenge!" 
                    : `~${totalStandardDrinks.toFixed(1)} standard drinks`}
                </Text>
              </View>
            </View>

            {/* Quick Sober Button */}
            {totalDrinks === 0 && (
              <Pressable
                onPress={handleMarkSober}
                disabled={saving}
                className="bg-green-500 rounded-2xl p-4 mb-4 flex-row items-center justify-center"
              >
                <Feather name="check-circle" size={24} color="white" />
                <Text className="text-white font-semibold text-base ml-2">
                  {saving ? "Saving..." : "I Stayed Sober Today"}
                </Text>
              </Pressable>
            )}

            {/* Drink Selection */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-3 ml-1">
                Log Drinks (if any)
              </Text>
              {DRINK_TYPES.map((drink) => (
                <DrinkCounter
                  key={drink.id}
                  drink={drink}
                  count={getDrinkCount(drink.id)}
                  onIncrement={() => updateDrinkCount(drink.id, 1)}
                  onDecrement={() => updateDrinkCount(drink.id, -1)}
                />
              ))}
            </View>

            {/* Notes Section */}
            {totalDrinks > 0 && (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <Text className="text-sm font-semibold text-gray-700 mb-3">
                  Notes (Optional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any context about today's drinking..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  className="bg-gray-50 rounded-xl p-4 text-gray-800 min-h-[80px]"
                  style={{ textAlignVertical: "top" }}
                />
              </View>
            )}

            {/* Info Card */}
            <View className="bg-amber-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <Feather name="info" size={20} color="#92400E" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-amber-800 mb-1">
                    75 Hard Challenge
                  </Text>
                  <Text className="text-xs text-amber-700">
                    The original challenge requires zero alcohol. Logging drinks 
                    helps you track patterns even if you slip up.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Save Button - only show if drinks logged */}
        {totalDrinks > 0 && (
          <View className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 border-t border-gray-100">
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="bg-red-500 py-4 rounded-2xl items-center"
            >
              {saving ? (
                <Text className="text-white font-semibold">Saving...</Text>
              ) : (
                <View className="flex-row items-center">
                  <Feather name="check" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Save & Log {totalDrinks} Drink{totalDrinks !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
