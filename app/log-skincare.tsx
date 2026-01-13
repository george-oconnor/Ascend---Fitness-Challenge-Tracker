import { createActivityLog, getActivityLogsForDate, updateActivityLog, updateDailyLog } from "@/lib/appwrite";
import { logger } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SKINCARE_STEPS = [
  "Cleanse",
  "Tone",
  "Serum",
  "Moisturize",
  "SPF",
];

export default function LogSkincareScreen() {
  const { date: dateParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; logId?: string }>();
  const { challenge, todayLog, updateProgress, allLogs, fetchAllLogs } = useChallengeStore();
  
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [saving, setSaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set()
  );
  const [notes, setNotes] = useState(targetLog?.skincareNotes ?? "");

  const toggleStep = (step: string) => {
    const newSteps = new Set(completedSteps);
    if (newSteps.has(step)) {
      newSteps.delete(step);
    } else {
      newSteps.add(step);
    }
    setCompletedSteps(newSteps);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isCompleted = completedSteps.size > 0;
      
      logger.info("Skincare routine logged", {
        type: "skincare",
        stepsCompleted: completedSteps.size,
        totalSteps: SKINCARE_STEPS.length,
        hasNotes: notes.trim().length > 0,
      });
      
      if (isEditingPastDay && logIdParam) {
        await updateDailyLog(logIdParam, {
          skincareCompleted: isCompleted,
          skincareNotes: notes.trim() || undefined,
        });
        
        if (isCompleted) {
          const dateStr = format(targetDate, 'yyyy-MM-dd');
          const existingLogs = await getActivityLogsForDate(challenge!.$id!, dateStr, 'skincare');
          const activityData = {
            userId: challenge!.userId,
            challengeId: challenge!.$id!,
            type: 'skincare' as const,
            title: "Skincare Routine Completed",
            description: `✨ ${completedSteps.size} step${completedSteps.size !== 1 ? 's' : ''} completed`,
            value: completedSteps.size,
            unit: "steps",
            date: dateStr,
          };
          
          if (existingLogs.length > 0) {
            await updateActivityLog(existingLogs[0].$id!, activityData);
          } else {
            await createActivityLog(activityData);
          }
        }
        
        await fetchAllLogs(challenge!.$id!);
      } else {
        await updateProgress({
          skincareCompleted: isCompleted,
          skincareNotes: notes.trim() || undefined,
        });

        if (isCompleted) {
          const { logActivity } = useChallengeStore.getState();
          await logActivity({
            type: "skincare",
            title: "Skincare Routine Completed",
            description: `✨ ${completedSteps.size} step${completedSteps.size !== 1 ? 's' : ''} completed`,
            value: completedSteps.size,
            unit: "steps",
          });
        }
      }

      router.back();
    } catch (err) {
      console.error("Failed to save skincare log:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-teal-50 to-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Skincare Routine</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Skincare Steps */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-700 mb-4">
              Completed Steps
            </Text>
            <View className="gap-3">
              {SKINCARE_STEPS.map((step) => (
                <Pressable
                  key={step}
                  onPress={() => toggleStep(step)}
                  className={`flex-row items-center p-4 rounded-xl border-2 ${
                    completedSteps.has(step)
                      ? "bg-teal-50 border-teal-400"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
                      completedSteps.has(step)
                        ? "bg-teal-400 border-teal-400"
                        : "border-gray-300"
                    }`}
                  >
                    {completedSteps.has(step) && (
                      <Feather name="check" size={16} color="white" />
                    )}
                  </View>
                  <Text
                    className={`text-base font-semibold ${
                      completedSteps.has(step)
                        ? "text-teal-900"
                        : "text-gray-700"
                    }`}
                  >
                    {step}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Progress */}
            <View className="mt-4 bg-teal-50 rounded-xl p-3">
              <Text className="text-sm text-teal-900">
                {completedSteps.size} of {SKINCARE_STEPS.length} steps completed
              </Text>
              <View className="w-full bg-teal-200 rounded-full h-2 mt-2 overflow-hidden">
                <View
                  className="bg-teal-500 h-full"
                  style={{
                    width: `${(completedSteps.size / SKINCARE_STEPS.length) * 100}%`,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              Notes (Optional)
            </Text>
            <TextInput
              className="bg-gray-50 rounded-xl p-4 text-base text-gray-900 min-h-24"
              placeholder="Add any notes about your skincare routine..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              editable={!saving}
            />
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 py-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={saving || completedSteps.size === 0}
          className={`py-4 rounded-xl flex-row items-center justify-center ${
            saving || completedSteps.size === 0
              ? "bg-gray-300"
              : "bg-teal-500"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Feather name="save" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Save Routine</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
