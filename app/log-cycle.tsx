import { createCycleLog, getCycleLog, getLastPeriodStart, updateCycleLog } from "@/lib/appwrite";
import { cycleHealthService } from "@/lib/cycleHealth";
import { captureException } from "@/lib/sentry";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { CervicalMucus, CycleLog, CycleSymptom, PeriodFlow, SexualActivityType } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Beta badge component
function BetaBadge() {
  return (
    <View className="bg-purple-500 px-2 py-0.5 rounded-full ml-2">
      <Text className="text-white text-xs font-bold">BETA</Text>
    </View>
  );
}

// Main mood options (synced with mood tracking)
type MoodOption = {
  score: number;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
};

const MOOD_OPTIONS: MoodOption[] = [
  { score: 1, icon: "frown", label: "Struggling", color: "#EF4444" },
  { score: 2, icon: "meh", label: "Down", color: "#F97316" },
  { score: 3, icon: "minus", label: "Okay", color: "#EAB308" },
  { score: 4, icon: "smile", label: "Good", color: "#22C55E" },
  { score: 5, icon: "sun", label: "Great", color: "#10B981" },
];

// Period flow options
const FLOW_OPTIONS: { value: PeriodFlow; label: string; icon: keyof typeof Feather.glyphMap; color: string; iconColor: string }[] = [
  { value: "none", label: "None", icon: "circle", color: "bg-gray-100", iconColor: "#9CA3AF" },
  { value: "spotting", label: "Spot", icon: "droplet", color: "bg-pink-100", iconColor: "#EC4899" },
  { value: "light", label: "Light", icon: "droplet", color: "bg-pink-200", iconColor: "#DB2777" },
  { value: "medium", label: "Med", icon: "droplet", color: "bg-red-200", iconColor: "#DC2626" },
  { value: "heavy", label: "Heavy", icon: "droplet", color: "bg-red-300", iconColor: "#B91C1C" },
];

// Cervical mucus options
const MUCUS_OPTIONS: { value: CervicalMucus; label: string }[] = [
  { value: "dry", label: "Dry" },
  { value: "sticky", label: "Sticky" },
  { value: "creamy", label: "Creamy" },
  { value: "watery", label: "Watery" },
  { value: "egg_white", label: "Egg White" },
];

// Symptom categories
type SymptomConfig = { 
  id: CycleSymptom; 
  label: string; 
  icon: keyof typeof Feather.glyphMap;
};

const PHYSICAL_SYMPTOMS: SymptomConfig[] = [
  { id: "cramps", label: "Cramps", icon: "alert-circle" },
  { id: "bloating", label: "Bloating", icon: "maximize" },
  { id: "breast_tenderness", label: "Breast Tenderness", icon: "heart" },
  { id: "headache", label: "Headache", icon: "frown" },
  { id: "migraine", label: "Migraine", icon: "zap" },
  { id: "fatigue", label: "Fatigue", icon: "battery" },
  { id: "backache", label: "Backache", icon: "arrow-left" },
  { id: "acne", label: "Acne", icon: "circle" },
  { id: "nausea", label: "Nausea", icon: "alert-triangle" },
  { id: "dizziness", label: "Dizziness", icon: "refresh-cw" },
  { id: "hot_flashes", label: "Hot Flashes", icon: "thermometer" },
  { id: "chills", label: "Chills", icon: "wind" },
  { id: "joint_pain", label: "Joint Pain", icon: "minus" },
  { id: "muscle_aches", label: "Muscle Aches", icon: "activity" },
];

const APPETITE_SYMPTOMS: SymptomConfig[] = [
  { id: "appetite_increase", label: "Increased Appetite", icon: "plus-circle" },
  { id: "appetite_decrease", label: "Decreased Appetite", icon: "minus-circle" },
  { id: "cravings", label: "Cravings", icon: "coffee" },
];

const DIGESTIVE_SYMPTOMS: SymptomConfig[] = [
  { id: "constipation", label: "Constipation", icon: "pause" },
  { id: "diarrhea", label: "Diarrhea", icon: "fast-forward" },
  { id: "gas", label: "Gas/Bloating", icon: "cloud" },
];

// Emotional symptoms - integrated with mood tracking
const EMOTIONAL_SYMPTOMS: SymptomConfig[] = [
  // Energy & Fatigue
  { id: "tired", label: "Tired", icon: "moon" },
  { id: "energetic", label: "Energetic", icon: "zap" },
  { id: "low_energy", label: "Low Energy", icon: "battery-charging" },
  { id: "high_energy", label: "High Energy", icon: "battery" },
  // Mood States
  { id: "calm", label: "Calm", icon: "sun" },
  { id: "anxiety", label: "Anxious", icon: "alert-circle" },
  { id: "stress", label: "Stressed", icon: "loader" },
  { id: "irritability", label: "Irritable", icon: "zap-off" },
  { id: "mood_swings", label: "Mood Swings", icon: "repeat" },
  { id: "depression", label: "Low Mood", icon: "trending-down" },
  // Emotional States
  { id: "crying", label: "Crying Spells", icon: "droplet" },
  { id: "sensitive", label: "Sensitive", icon: "heart" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "layers" },
  { id: "frustrated", label: "Frustrated", icon: "x-circle" },
  { id: "restless", label: "Restless", icon: "wind" },
  // Positive States
  { id: "excited", label: "Excited", icon: "star" },
  { id: "grateful", label: "Grateful", icon: "gift" },
  { id: "motivated", label: "Motivated", icon: "target" },
  { id: "hopeful", label: "Hopeful", icon: "sunrise" },
  { id: "content", label: "Content", icon: "smile" },
  { id: "focused", label: "Focused", icon: "crosshair" },
  // Mental
  { id: "brain_fog", label: "Brain Fog", icon: "cloud" },
  { id: "insomnia", label: "Insomnia", icon: "eye-off" },
  { id: "lonely", label: "Lonely", icon: "user" },
];

// Symptom chip component
function SymptomChip({ 
  config, 
  isSelected, 
  onToggle 
}: { 
  config: SymptomConfig; 
  isSelected: boolean; 
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center px-3 py-2 rounded-full ${
        isSelected ? "bg-pink-500" : "bg-gray-100"
      }`}
    >
      <Feather 
        name={config.icon} 
        size={14} 
        color={isSelected ? "white" : "#6B7280"} 
        style={{ marginRight: 4 }}
      />
      <Text className={`text-sm ${isSelected ? "text-white font-medium" : "text-gray-700"}`}>
        {config.label}
      </Text>
    </Pressable>
  );
}

// Section component
function Section({ 
  title, 
  children,
  icon,
}: { 
  title: string; 
  children: React.ReactNode;
  icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
      <View className="flex-row items-center mb-3">
        {icon && (
          <View className="h-6 w-6 rounded-full bg-pink-100 items-center justify-center mr-2">
            <Feather name={icon} size={14} color="#EC4899" />
          </View>
        )}
        <Text className="text-sm font-semibold text-gray-700">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function LogCycleScreen() {
  const router = useRouter();
  const { user } = useSessionStore();
  const { challenge, todayLog, updateProgress } = useChallengeStore();
  
  // State
  const [existingLog, setExistingLog] = useState<CycleLog | null>(null);
  const [periodFlow, setPeriodFlow] = useState<PeriodFlow>("none");
  const [isPeriodStart, setIsPeriodStart] = useState(false);
  const [isPeriodEnd, setIsPeriodEnd] = useState(false);
  const [symptoms, setSymptoms] = useState<Set<CycleSymptom>>(new Set());
  const [cervicalMucus, setCervicalMucus] = useState<CervicalMucus | null>(null);
  const [sexualActivity, setSexualActivity] = useState<SexualActivityType>({
    hadActivity: false,
    protected: undefined,
  });
  const [ovulationTest, setOvulationTest] = useState<"positive" | "negative" | "not_taken">("not_taken");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  
  // Mood state - synced with main mood tracking
  const [selectedMood, setSelectedMood] = useState<number>(todayLog?.moodScore ?? 0);

  // Sync mood and emotions from challenge store when it loads
  useEffect(() => {
    if (todayLog?.moodScore) {
      setSelectedMood(todayLog.moodScore);
    }
    
    // Sync secondary emotions from mood tracking to cycle symptoms
    if (todayLog?.moodNotes) {
      try {
        if (todayLog.moodNotes.startsWith('{"emotions":')) {
          const parsed = JSON.parse(todayLog.moodNotes);
          if (parsed.emotions && Array.isArray(parsed.emotions)) {
            // Map mood emotion IDs to cycle symptom IDs (they use slightly different naming)
            const emotionToCycleMap: Record<string, CycleSymptom> = {
              "tired": "tired",
              "energetic": "energetic",
              "anxious": "anxiety",
              "calm": "calm",
              "stressed": "stress",
              "irritable": "irritability",
              "sensitive": "sensitive",
              "overwhelmed": "overwhelmed",
              "frustrated": "frustrated",
              "restless": "restless",
              "excited": "excited",
              "grateful": "grateful",
              "motivated": "motivated",
              "hopeful": "hopeful",
              "content": "content",
              "focused": "focused",
              "brain_fog": "brain_fog",
              "lonely": "lonely",
            };
            
            setSymptoms(prev => {
              const next = new Set(prev);
              parsed.emotions.forEach((emotionId: string) => {
                const cycleSymptom = emotionToCycleMap[emotionId];
                if (cycleSymptom) {
                  next.add(cycleSymptom);
                }
              });
              return next;
            });
          }
        }
      } catch {}
    }
  }, [todayLog?.moodScore, todayLog?.moodNotes]);

  // Load existing cycle log for today (from app database and Apple Health)
  useEffect(() => {
    const loadTodayLog = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        
        // Fetch from both app database and Apple Health in parallel
        const [log, healthData] = await Promise.all([
          getCycleLog(user.id, today),
          cycleHealthService.getCycleDataForDate(new Date()).catch(() => null),
        ]);
        
        if (log) {
          setExistingLog(log);
          setPeriodFlow((log.periodFlow as PeriodFlow) || "none");
          setIsPeriodStart(log.isPeriodStart || false);
          setIsPeriodEnd(log.isPeriodEnd || false);
          setCervicalMucus((log.cervicalMucus as CervicalMucus) || null);
          setOvulationTest((log.ovulationTest as "positive" | "negative" | "not_taken") || "not_taken");
          setNotes(log.notes || "");
          setCycleDay(log.cycleDay || null);
          
          // Parse symptoms
          if (log.symptoms) {
            try {
              const parsed = JSON.parse(log.symptoms);
              setSymptoms(new Set(parsed));
            } catch {}
          }
          
          // Parse sexual activity
          if (log.sexualActivity) {
            try {
              const parsed = JSON.parse(log.sexualActivity);
              setSexualActivity(parsed);
            } catch {}
          }
        } else if (healthData) {
          // No app data but we have Apple Health data - pre-fill from HealthKit
          if (healthData.periodFlow) {
            setPeriodFlow(healthData.periodFlow);
          }
          if (healthData.cervicalMucus) {
            setCervicalMucus(healthData.cervicalMucus);
          }
          if (healthData.ovulationTest) {
            setOvulationTest(healthData.ovulationTest);
          }
          if (healthData.sexualActivity) {
            setSexualActivity(healthData.sexualActivity);
          }
          
          // Calculate cycle day from last period start
          const lastPeriod = await getLastPeriodStart(user.id);
          if (lastPeriod?.date) {
            const lastStart = new Date(lastPeriod.date);
            const todayDate = new Date();
            const diffDays = Math.floor((todayDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            setCycleDay(diffDays);
          }
        } else {
          // No data from either source - calculate cycle day
          const lastPeriod = await getLastPeriodStart(user.id);
          if (lastPeriod?.date) {
            const lastStart = new Date(lastPeriod.date);
            const todayDate = new Date();
            const diffDays = Math.floor((todayDate.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            setCycleDay(diffDays);
          }
        }
      } catch (err) {
        console.error("Failed to load cycle log:", err);
      } finally {
        setLoading(false);
      }
    };
    
    loadTodayLog();
  }, [user?.id]);

  const toggleSymptom = (symptom: CycleSymptom) => {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(symptom)) {
        next.delete(symptom);
      } else {
        next.add(symptom);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      
      // Build cycle log data
      const cycleData: Omit<CycleLog, "$id"> = {
        userId: user.id,
        date: today,
        periodFlow: periodFlow !== "none" ? periodFlow : undefined,
        isPeriodStart: isPeriodStart || undefined,
        isPeriodEnd: isPeriodEnd || undefined,
        symptoms: symptoms.size > 0 ? JSON.stringify(Array.from(symptoms)) : undefined,
        cervicalMucus: cervicalMucus || undefined,
        sexualActivity: sexualActivity.hadActivity ? JSON.stringify(sexualActivity) : undefined,
        ovulationTest: ovulationTest !== "not_taken" ? ovulationTest : undefined,
        notes: notes.trim() || undefined,
        cycleDay: cycleDay || undefined,
      };

      if (existingLog?.$id) {
        // Update existing log
        await updateCycleLog(existingLog.$id, cycleData);
      } else {
        // Create new log
        await createCycleLog(cycleData);
      }
      
      // Sync to Apple Health
      try {
        await cycleHealthService.saveCycleData({
          date: new Date(),
          periodFlow: periodFlow !== "none" ? periodFlow : undefined,
          cervicalMucus: cervicalMucus || undefined,
          ovulationTest: ovulationTest !== "not_taken" ? ovulationTest : undefined,
          sexualActivity: sexualActivity.hadActivity ? sexualActivity : undefined,
        });
      } catch (healthError: any) {
        console.log("HealthKit sync skipped or failed:", healthError);
        const flowStr = periodFlow !== "none" ? periodFlow : "none";
        captureException(new Error(`Apple Health cycle sync failed: ${healthError?.message || JSON.stringify(healthError)}`), {
          periodFlow: flowStr,
          hasSymptoms: symptoms.size > 0,
          symptomCount: symptoms.size,
          cervicalMucus: cervicalMucus || undefined,
          ovulationTest: ovulationTest !== "not_taken" ? ovulationTest : undefined,
        });
      }
      
      // Sync mood to challenge store if mood was selected
      if (selectedMood > 0 && challenge?.trackMood) {
        // Get emotional symptoms as secondary emotions for mood notes
        const emotionalSymptomIds = Array.from(symptoms).filter(s => 
          EMOTIONAL_SYMPTOMS.some(es => es.id === s)
        );
        
        let moodNotes: string | undefined;
        if (emotionalSymptomIds.length > 0) {
          moodNotes = JSON.stringify({
            emotions: emotionalSymptomIds,
            notes: "",
          });
        }
        
        await updateProgress({
          moodScore: selectedMood,
          moodNotes,
        });
      }

      router.back();
    } catch (err) {
      console.error("Failed to save cycle data:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <View className="flex-row items-center">
          <Text className="text-lg font-bold text-gray-900">Cycle Tracking</Text>
          <BetaBadge />
        </View>
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
            {/* Header */}
            <View className="items-center mb-6">
              <View className="h-20 w-20 rounded-full bg-pink-100 items-center justify-center mb-3">
                <Feather name="heart" size={40} color="#EC4899" />
              </View>
              <Text className="text-xl font-bold text-gray-800">Log Today's Cycle</Text>
              <Text className="text-sm text-gray-500 mt-1">
                Track your cycle to understand your body better
              </Text>
              {cycleDay && (
                <View className="mt-3 bg-pink-100 px-4 py-2 rounded-full">
                  <Text className="text-pink-700 font-medium">
                    Cycle Day {cycleDay}
                  </Text>
                </View>
              )}
            </View>

            {/* Period Flow */}
            <Section title="Period Flow" icon="droplet">
              <View className="flex-row justify-between">
                {FLOW_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setPeriodFlow(option.value)}
                    className={`flex-1 mx-1 py-3 rounded-xl items-center ${
                      periodFlow === option.value
                        ? "bg-pink-500"
                        : option.color
                    }`}
                  >
                    <Feather 
                      name={option.icon} 
                      size={20} 
                      color={periodFlow === option.value ? "white" : option.iconColor} 
                    />
                    <Text
                      className={`text-xs font-medium mt-1 ${
                        periodFlow === option.value ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {periodFlow !== "none" && (
                <View className="mt-4 pt-4 border-t border-gray-100">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm text-gray-600">Period Started Today?</Text>
                    <Switch
                      value={isPeriodStart}
                      onValueChange={setIsPeriodStart}
                      trackColor={{ false: "#E5E7EB", true: "#EC4899" }}
                      thumbColor="white"
                    />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-gray-600">Period Ended Today?</Text>
                    <Switch
                      value={isPeriodEnd}
                      onValueChange={setIsPeriodEnd}
                      trackColor={{ false: "#E5E7EB", true: "#EC4899" }}
                      thumbColor="white"
                    />
                  </View>
                </View>
              )}
            </Section>

            {/* Sexual Activity */}
            <Section title="Sexual Activity" icon="heart">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm text-gray-600">Had sexual activity today?</Text>
                <Switch
                  value={sexualActivity.hadActivity}
                  onValueChange={(value) =>
                    setSexualActivity((prev) => ({ ...prev, hadActivity: value }))
                  }
                  trackColor={{ false: "#E5E7EB", true: "#EC4899" }}
                  thumbColor="white"
                />
              </View>

              {sexualActivity.hadActivity && (
                <View className="pt-3 border-t border-gray-100">
                  <Text className="text-sm text-gray-600 mb-2">Protection used?</Text>
                  <View className="flex-row">
                    <Pressable
                      onPress={() =>
                        setSexualActivity((prev) => ({ ...prev, protected: true }))
                      }
                      className={`flex-1 py-3 rounded-xl mr-2 ${
                        sexualActivity.protected === true
                          ? "bg-green-500"
                          : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          sexualActivity.protected === true
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        Yes
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setSexualActivity((prev) => ({ ...prev, protected: false }))
                      }
                      className={`flex-1 py-3 rounded-xl ${
                        sexualActivity.protected === false
                          ? "bg-pink-500"
                          : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          sexualActivity.protected === false
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        No
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Section>

            {/* Physical Symptoms */}
            <Section title="Physical Symptoms" icon="activity">
              <View className="flex-row flex-wrap justify-center gap-2">
                {PHYSICAL_SYMPTOMS.map((symptom) => (
                  <SymptomChip
                    key={symptom.id}
                    config={symptom}
                    isSelected={symptoms.has(symptom.id)}
                    onToggle={() => toggleSymptom(symptom.id)}
                  />
                ))}
              </View>
            </Section>

            {/* Appetite */}
            <Section title="Appetite & Cravings" icon="coffee">
              <View className="flex-row flex-wrap justify-center gap-2">
                {APPETITE_SYMPTOMS.map((symptom) => (
                  <SymptomChip
                    key={symptom.id}
                    config={symptom}
                    isSelected={symptoms.has(symptom.id)}
                    onToggle={() => toggleSymptom(symptom.id)}
                  />
                ))}
              </View>
            </Section>

            {/* Digestive */}
            <Section title="Digestive" icon="loader">
              <View className="flex-row flex-wrap justify-center gap-2">
                {DIGESTIVE_SYMPTOMS.map((symptom) => (
                  <SymptomChip
                    key={symptom.id}
                    config={symptom}
                    isSelected={symptoms.has(symptom.id)}
                    onToggle={() => toggleSymptom(symptom.id)}
                  />
                ))}
              </View>
            </Section>

            {/* Main Mood - synced with mood tracking */}
            {challenge?.trackMood && (
              <Section title="Overall Mood" icon="smile">
                <Text className="text-xs text-gray-500 mb-3">
                  {todayLog?.moodScore ? "Synced with your mood tracking" : "This will also update your daily mood"}
                </Text>
                <View className="flex-row justify-between">
                  {MOOD_OPTIONS.map((option) => (
                    <Pressable
                      key={option.score}
                      onPress={() => setSelectedMood(option.score)}
                      className={`flex-1 mx-1 py-3 rounded-xl items-center ${
                        selectedMood === option.score ? "bg-pink-500" : "bg-gray-100"
                      }`}
                    >
                      <Feather 
                        name={option.icon} 
                        size={20} 
                        color={selectedMood === option.score ? "white" : option.color} 
                      />
                      <Text
                        className={`text-xs font-medium mt-1 ${
                          selectedMood === option.score ? "text-white" : "text-gray-700"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Section>
            )}

            {/* Emotional Symptoms */}
            <Section title="Mood Details" icon="heart">
              <Text className="text-xs text-gray-500 mb-3">
                Select any that apply to add more detail
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {EMOTIONAL_SYMPTOMS.map((symptom) => (
                  <SymptomChip
                    key={symptom.id}
                    config={symptom}
                    isSelected={symptoms.has(symptom.id)}
                    onToggle={() => toggleSymptom(symptom.id)}
                  />
                ))}
              </View>
            </Section>

            {/* Cervical Mucus */}
            <Section title="Cervical Mucus (Optional)" icon="droplet">
              <Text className="text-xs text-gray-500 mb-3">
                Tracking this helps predict fertile windows
              </Text>
              <View className="flex-row justify-between">
                {MUCUS_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setCervicalMucus(
                        cervicalMucus === option.value ? null : option.value
                      )
                    }
                    className={`flex-1 mx-1 py-3 rounded-xl items-center ${
                      cervicalMucus === option.value
                        ? "bg-blue-500"
                        : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        cervicalMucus === option.value
                          ? "text-white"
                          : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            {/* Ovulation Test */}
            <Section title="Ovulation Test (Optional)" icon="thermometer">
              <View className="flex-row">
                <Pressable
                  onPress={() => setOvulationTest("not_taken")}
                  className={`flex-1 py-3 rounded-xl mr-2 ${
                    ovulationTest === "not_taken" ? "bg-gray-400" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      ovulationTest === "not_taken" ? "text-white" : "text-gray-700"
                    }`}
                  >
                    Not Taken
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setOvulationTest("negative")}
                  className={`flex-1 py-3 rounded-xl mr-2 ${
                    ovulationTest === "negative" ? "bg-pink-400" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      ovulationTest === "negative" ? "text-white" : "text-gray-700"
                    }`}
                  >
                    Negative
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setOvulationTest("positive")}
                  className={`flex-1 py-3 rounded-xl ${
                    ovulationTest === "positive" ? "bg-green-500" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      ovulationTest === "positive" ? "text-white" : "text-gray-700"
                    }`}
                  >
                    Positive
                  </Text>
                </Pressable>
              </View>
            </Section>

            {/* Notes */}
            <Section title="Notes" icon="edit-3">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any other notes about today..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="bg-gray-50 rounded-xl p-3 text-gray-800 min-h-[80px]"
                style={{ textAlignVertical: "top" }}
              />
            </Section>

            {/* Info Card */}
            <View className="bg-purple-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Feather name="heart" size={18} color="#7C3AED" />
                <Text className="text-sm font-semibold text-purple-800 ml-2">Apple Health Sync</Text>
              </View>
              <Text className="text-sm text-purple-700">
                Your cycle data automatically syncs to Apple Health when you save. Period flow, cervical mucus, ovulation tests, and sexual activity are all tracked.
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
              saving ? "bg-gray-300" : "bg-pink-500"
            }`}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white font-bold text-lg ml-2">Saving...</Text>
              </View>
            ) : (
              <Text className="text-white font-bold text-lg">Save Cycle Log</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
