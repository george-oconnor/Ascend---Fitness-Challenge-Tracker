import { createActivityLog, getActivityLogsForDate, updateActivityLog, updateDailyLog } from "@/lib/appwrite";
import { healthSyncService } from "@/lib/healthSync";
import { captureException } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Mood options with emojis and labels
type MoodOption = {
  score: number;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  bgColor: string;
  description: string;
};

const MOOD_OPTIONS: MoodOption[] = [
  {
    score: 1,
    icon: "frown",
    label: "Struggling",
    color: "#EF4444",
    bgColor: "bg-red-50",
    description: "Having a tough day",
  },
  {
    score: 2,
    icon: "meh",
    label: "Down",
    color: "#F97316",
    bgColor: "bg-orange-50",
    description: "Feeling low energy",
  },
  {
    score: 3,
    icon: "minus",
    label: "Okay",
    color: "#EAB308",
    bgColor: "bg-yellow-50",
    description: "Just getting by",
  },
  {
    score: 4,
    icon: "smile",
    label: "Good",
    color: "#22C55E",
    bgColor: "bg-green-50",
    description: "Feeling positive",
  },
  {
    score: 5,
    icon: "sun",
    label: "Great",
    color: "#10B981",
    bgColor: "bg-emerald-50",
    description: "Feeling amazing!",
  },
];

// Secondary emotions for more context - integrated with cycle tracking
type Emotion = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
};

const EMOTIONS: Emotion[] = [
  // Energy & Fatigue
  { id: "tired", icon: "moon", label: "Tired" },
  { id: "energetic", icon: "zap", label: "Energetic" },
  // Mood States
  { id: "anxious", icon: "alert-circle", label: "Anxious" },
  { id: "calm", icon: "sun", label: "Calm" },
  { id: "stressed", icon: "loader", label: "Stressed" },
  { id: "irritable", icon: "zap-off", label: "Irritable" },
  // Emotional States
  { id: "sensitive", icon: "heart", label: "Sensitive" },
  { id: "overwhelmed", icon: "layers", label: "Overwhelmed" },
  { id: "frustrated", icon: "x-circle", label: "Frustrated" },
  { id: "restless", icon: "wind", label: "Restless" },
  // Positive States
  { id: "excited", icon: "star", label: "Excited" },
  { id: "grateful", icon: "gift", label: "Grateful" },
  { id: "motivated", icon: "target", label: "Motivated" },
  { id: "hopeful", icon: "sunrise", label: "Hopeful" },
  { id: "content", icon: "smile", label: "Content" },
  { id: "focused", icon: "crosshair", label: "Focused" },
  // Mental
  { id: "brain_fog", icon: "cloud", label: "Brain Fog" },
  { id: "lonely", icon: "user", label: "Lonely" },
];

// Mood card component
function MoodCard({ 
  option, 
  isSelected, 
  onSelect 
}: { 
  option: MoodOption; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className={`${option.bgColor} rounded-xl p-3 mb-2 flex-row items-center ${
        isSelected ? "border-2" : "border-2 border-transparent"
      }`}
      style={isSelected ? { borderColor: option.color } : undefined}
    >
      <View className="h-10 w-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: option.color + "30" }}>
        <Feather name={option.icon} size={24} color={option.color} />
      </View>
      <View className="flex-1">
        <Text 
          className="text-base font-semibold"
          style={{ color: option.color }}
        >
          {option.label}
        </Text>
        <Text className="text-xs text-gray-500">{option.description}</Text>
      </View>
      {isSelected && (
        <View 
          className="h-6 w-6 rounded-full items-center justify-center"
          style={{ backgroundColor: option.color }}
        >
          <Feather name="check" size={14} color="white" />
        </View>
      )}
    </Pressable>
  );
}

// Emotion chip component for secondary emotions
function EmotionChip({ 
  emotion, 
  isSelected, 
  onToggle 
}: { 
  emotion: Emotion; 
  isSelected: boolean; 
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className={`rounded-full px-3 py-2 mr-2 mb-2 flex-row items-center ${
        isSelected ? "bg-amber-100 border border-amber-400" : "bg-gray-100 border border-transparent"
      }`}
    >
      <Feather 
        name={emotion.icon} 
        size={16} 
        color={isSelected ? "#B45309" : "#6B7280"} 
        style={{ marginRight: 4 }}
      />
      <Text className={`text-sm ${isSelected ? "font-semibold text-amber-700" : "text-gray-600"}`}>
        {emotion.label}
      </Text>
    </Pressable>
  );
}

// Motivational quotes based on mood
const MOOD_MESSAGES: Record<number, string[]> = {
  1: [
    "It's okay to have hard days. Tomorrow is a fresh start!",
    "You're stronger than you think. This too shall pass.",
    "Even small steps forward count. You've got this!",
  ],
  2: [
    "Low days are part of the journey. Keep going!",
    "Remember why you started. You're doing great!",
    "One day at a time. Progress isn't always linear.",
  ],
  3: [
    "Steady progress is still progress! Keep it up!",
    "You showed up today, and that matters!",
    "Consistency beats perfection. Stay the course!",
  ],
  4: [
    "Great energy today! Keep riding that wave!",
    "Your positive attitude is your superpower!",
    "Good vibes lead to great results! Keep going!",
  ],
  5: [
    "You're absolutely crushing it! What a champion!",
    "This energy is contagious! Spread the positivity!",
    "Amazing! This is what success feels like!",
  ],
};

function getRandomMessage(score: number): string {
  const messages = MOOD_MESSAGES[score] || MOOD_MESSAGES[3];
  return messages[Math.floor(Math.random() * messages.length)];
}

export default function LogMoodScreen() {
  const router = useRouter();
  const { date: dateParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; logId?: string }>();
  const { challenge, todayLog, updateProgress, allLogs, fetchAllLogs } = useChallengeStore();
  
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [selectedMood, setSelectedMood] = useState<number>(targetLog?.moodScore ?? 0);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [notes, setNotes] = useState(targetLog?.moodNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Parse emotions from notes if they exist (stored as JSON prefix)
  useEffect(() => {
    if (targetLog?.moodNotes) {
      try {
        // Check if notes start with emotions JSON
        if (targetLog.moodNotes.startsWith('{"emotions":')) {
          const parsed = JSON.parse(targetLog.moodNotes);
          setSelectedEmotions(parsed.emotions || []);
          setNotes(parsed.notes || "");
        } else {
          setNotes(targetLog.moodNotes);
        }
      } catch {
        setNotes(targetLog.moodNotes);
      }
    }
    if (targetLog?.moodScore) {
      setSelectedMood(targetLog.moodScore);
    }
  }, [targetLog?.moodScore, targetLog?.moodNotes]);

  // Toggle emotion selection
  const toggleEmotion = (emotionId: string) => {
    setSelectedEmotions(prev => 
      prev.includes(emotionId) 
        ? prev.filter(id => id !== emotionId)
        : [...prev, emotionId]
    );
  };

  // Update motivational message when mood changes
  useEffect(() => {
    if (selectedMood > 0) {
      setMessage(getRandomMessage(selectedMood));
    }
  }, [selectedMood]);

  if (!challenge || !targetLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const selectedOption = MOOD_OPTIONS.find(m => m.score === selectedMood);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Combine emotions and notes into a JSON string for storage
      let moodNotes: string | undefined;
      if (selectedEmotions.length > 0 || notes.trim()) {
        moodNotes = JSON.stringify({
          emotions: selectedEmotions,
          notes: notes.trim(),
        });
      }
      
      // Sync to Apple Health State of Mind (iOS 17+)
      try {
        await healthSyncService.saveMood(selectedMood, selectedEmotions);
      } catch (healthError: any) {
        console.error("Error saving mood to HealthKit:", healthError);
        captureException(new Error(`Apple Health mood sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
          moodScore: selectedMood,
          emotionCount: selectedEmotions.length,
        });
      }
      
      if (isEditingPastDay && logIdParam) {
        await updateDailyLog(logIdParam, {
          moodScore: selectedMood,
          moodNotes,
        });
        
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const existingLogs = await getActivityLogsForDate(challenge.$id!, dateStr, 'mood');
        const activityData = {
          userId: challenge.userId,
          challengeId: challenge.$id!,
          type: 'mood' as const,
          title: "Mood Logged",
          description: `${selectedOption?.emoji || "😊"} Feeling ${selectedOption?.label || "Good"}${selectedEmotions.length > 0 ? ` - ${selectedEmotions.length} emotion${selectedEmotions.length !== 1 ? 's' : ''} noted` : ""}`,
          value: selectedMood,
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
          moodScore: selectedMood,
          moodNotes,
        });

        const { logActivity } = useChallengeStore.getState();
        await logActivity({
          type: "mood",
          title: "Mood Logged",
          description: `${selectedOption?.emoji || "😊"} Feeling ${selectedOption?.label || "Good"}${selectedEmotions.length > 0 ? ` - ${selectedEmotions.length} emotion${selectedEmotions.length !== 1 ? 's' : ''} noted` : ""}`,
          value: selectedMood,
        });
      }
      
      router.back();
    } catch (err) {
      console.error("Failed to save mood:", err);
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
        <Text className="text-lg font-bold text-gray-900">How are you feeling?</Text>
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
            {/* Mood Header */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex-row items-center">
              <View className="bg-amber-100 h-16 w-16 rounded-full items-center justify-center mr-4">
                <Feather name={selectedOption?.icon || "help-circle"} size={28} color={selectedOption?.color || "#9CA3AF"} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-800">
                  {selectedOption ? `Feeling ${selectedOption.label}` : "Select your mood"}
                </Text>
                <Text className="text-sm text-gray-500">
                  {selectedOption?.description || "Tap below to log how you're feeling"}
                </Text>
              </View>
            </View>

            {/* Mood Selection */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-3 ml-1">
                Select Your Mood
              </Text>
              <View>
                {MOOD_OPTIONS.map((option) => (
                  <MoodCard
                    key={option.score}
                    option={option}
                    isSelected={selectedMood === option.score}
                    onSelect={() => setSelectedMood(option.score)}
                  />
                ))}
              </View>
            </View>

            {/* Secondary Emotions */}
            {selectedMood > 0 && (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <Text className="text-sm font-semibold text-gray-700 mb-3 ml-1">
                  What else are you feeling? (Optional)
                </Text>
                <View className="flex-row flex-wrap">
                  {EMOTIONS.map((emotion) => (
                    <EmotionChip
                      key={emotion.id}
                      emotion={emotion}
                      isSelected={selectedEmotions.includes(emotion.id)}
                      onToggle={() => toggleEmotion(emotion.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Motivational Message */}
            {selectedMood > 0 && (
              <View 
                className={`rounded-2xl p-4 mb-4 ${selectedOption?.bgColor || "bg-gray-50"}`}
              >
                <View className="flex-row items-start">
                  <Feather name="message-circle" size={20} color={selectedOption?.color} style={{ marginRight: 12, marginTop: 2 }} />
                  <View className="flex-1">
                    <Text 
                      className="text-base font-medium"
                      style={{ color: selectedOption?.color }}
                    >
                      {message}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Notes Section */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="text-sm font-semibold text-gray-700 mb-3">
                Add Notes (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="What's on your mind? Any thoughts about today..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                className="bg-gray-50 rounded-xl p-4 text-gray-800 min-h-[100px]"
                style={{ textAlignVertical: "top" }}
              />
            </View>

            {/* Mood Streak / Tip */}
            <View className="bg-amber-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <Feather name="heart" size={20} color="#92400E" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-amber-800 mb-1">
                    Apple Health Sync
                  </Text>
                  <Text className="text-xs text-amber-700">
                    Your mood syncs to Apple Health's State of Mind (iOS 17+). Track patterns across your 75 Hard journey!
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
            disabled={saving || selectedMood === 0}
            className={`py-4 rounded-2xl items-center ${
              selectedMood > 0 ? "bg-amber-500" : "bg-gray-300"
            }`}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white font-semibold ml-2">Saving...</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Feather name="check" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  {selectedMood > 0 ? "Save Mood" : "Select a Mood"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
