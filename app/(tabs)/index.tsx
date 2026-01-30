import ActivityProgressCard from "@/components/ActivityProgressCard";
import ChallengeStatusCard from "@/components/ChallengeStatusCard";
import Header from "@/components/Header";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Animated empty state illustration
function EmptyStateIllustration() {
  const bounce = useRef(new Animated.Value(0)).current;
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Main icon bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -8, duration: 1000, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
    
    // Floating particles
    const floatAnim = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    };
    floatAnim(float1, 0);
    floatAnim(float2, 500);
    floatAnim(float3, 1000);
  }, []);

  return (
    <View className="items-center justify-center h-32 mb-2">
      {/* Floating decorative elements */}
      <Animated.View 
        style={{ 
          position: 'absolute', 
          left: 40, 
          top: 10,
          opacity: float1.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
          transform: [{ translateY: float1.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }]
        }}
      >
        <Text style={{ fontSize: 20 }}>💪</Text>
      </Animated.View>
      <Animated.View 
        style={{ 
          position: 'absolute', 
          right: 50, 
          top: 5,
          opacity: float2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
          transform: [{ translateY: float2.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }]
        }}
      >
        <Text style={{ fontSize: 18 }}>📚</Text>
      </Animated.View>
      <Animated.View 
        style={{ 
          position: 'absolute', 
          right: 70, 
          bottom: 20,
          opacity: float3.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
          transform: [{ translateY: float3.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }]
        }}
      >
        <Text style={{ fontSize: 16 }}>💧</Text>
      </Animated.View>
      
      {/* Main bouncing icon */}
      <Animated.View 
        className="h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br"
        style={{ 
          backgroundColor: '#EDE9FE',
          transform: [{ translateY: bounce }],
          shadowColor: '#8B5CF6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }}
      >
        <Feather name="target" size={40} color="#8B5CF6" />
      </Animated.View>
    </View>
  );
}

// Section header with line
function SectionHeader({ title, icon }: { title: string; icon?: keyof typeof Feather.glyphMap }) {
  return (
    <View className="flex-row items-center mb-3 mt-2">
      {icon && (
        <View className="h-6 w-6 rounded-full bg-gray-100 items-center justify-center mr-2">
          <Feather name={icon} size={12} color="#6B7280" />
        </View>
      )}
      <Text className="text-sm font-semibold text-gray-600">{title}</Text>
      <View className="flex-1 h-px bg-gray-200 ml-3" />
    </View>
  );
}

// Mini confetti celebration overlay
function ConfettiCelebration({ show }: { show: boolean }) {
  const confettiPieces = useRef(
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: new Animated.Value(Math.random() * 350),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: ['#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#22C55E'][Math.floor(Math.random() * 6)],
      size: Math.random() * 8 + 4,
    }))
  ).current;
  
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      setVisible(true);
      confettiPieces.forEach((piece, i) => {
        piece.y.setValue(-20);
        piece.opacity.setValue(1);
        piece.x.setValue(Math.random() * 350);
        
        Animated.sequence([
          Animated.delay(i * 30),
          Animated.parallel([
            Animated.timing(piece.y, {
              toValue: 600,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(piece.x, {
              toValue: piece.x._value + (Math.random() - 0.5) * 100,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(piece.rotate, {
              toValue: Math.random() * 720,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(1500),
              Animated.timing(piece.opacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]).start();
      });
      
      setTimeout(() => setVisible(false), 3000);
    }
  }, [show]);
  
  if (!visible) return null;
  
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      {confettiPieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={{
            position: 'absolute',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.size / 2,
            transform: [
              { translateX: piece.x },
              { translateY: piece.y },
              { rotate: piece.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
            ],
            opacity: piece.opacity,
          }}
        />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useSessionStore();
  const { challenge, todayLog, fetchChallenge, fetchAllLogs, syncHealthData } = useChallengeStore();
  const { isAuthorized, fetchTodayData, steps, workouts } = useHealthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const wasCompleteRef = useRef(false);

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id]);

  // Fetch all logs when challenge is loaded (needed for photo frequency checking)
  useEffect(() => {
    if (challenge?.$id) {
      fetchAllLogs(challenge.$id);
    }
  }, [challenge?.$id, fetchAllLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Sync health data from Apple Health first if available
      if (Platform.OS === "ios" && isAuthorized) {
        // Fetch latest health data from Apple Health
        await fetchTodayData();
      }
      
      // Refresh challenge data (this also fetches today's log)
      if (user?.id) {
        await fetchChallenge(user.id);
      }
      
      // Sync health data to daily log after challenge is refreshed
      // Get fresh values from store instead of using closure variables
      if (Platform.OS === "ios" && isAuthorized) {
        const { challenge: freshChallenge, todayLog: freshTodayLog } = useChallengeStore.getState();
        if (freshChallenge?.$id && freshTodayLog?.$id) {
          await syncHealthData();
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, isAuthorized, fetchChallenge, fetchTodayData, syncHealthData]);

  // Auto-sync health data when it changes
  useEffect(() => {
    if (Platform.OS === "ios" && isAuthorized && challenge?.$id && todayLog?.$id) {
      syncHealthData();
    }
  }, [steps, workouts, isAuthorized, challenge?.$id, todayLog?.$id]);

  // Check for all tasks complete and trigger confetti
  useEffect(() => {
    if (!challenge || !todayLog) return;
    
    // Count completed activities
    let completedCount = 0;
    let totalCount = 0;
    
    if (challenge.trackSteps) {
      totalCount++;
      const stepsCount = isAuthorized ? steps : (todayLog.stepsCount ?? 0);
      if (stepsCount >= (challenge.stepsGoal ?? 0)) completedCount++;
    }
    if (challenge.trackWorkout1) {
      totalCount++;
      if ((todayLog.workout1Minutes ?? 0) >= challenge.workoutMinutes) completedCount++;
    }
    if (challenge.trackWorkout2) {
      totalCount++;
      if ((todayLog.workout2Minutes ?? 0) >= challenge.workoutMinutes) completedCount++;
    }
    if (challenge.trackDiet) {
      totalCount++;
      if (todayLog.dietCompleted) completedCount++;
    }
    if (challenge.trackWater) {
      totalCount++;
      if ((todayLog.waterLiters ?? 0) >= challenge.waterLiters) completedCount++;
    }
    if (challenge.trackReading) {
      totalCount++;
      if ((todayLog.readingPages ?? 0) >= challenge.readingPages || todayLog.readingCompleted) completedCount++;
    }
    if (challenge.trackProgressPhoto) {
      totalCount++;
      if (todayLog.progressPhotoCompleted) completedCount++;
    }
    if (challenge.trackNoAlcohol) {
      totalCount++;
      if (todayLog.noAlcoholCompleted) completedCount++;
    }
    if (challenge.trackWeight) {
      totalCount++;
      if (todayLog.weightLogged) completedCount++;
    }
    if (challenge.trackMood) {
      totalCount++;
      if ((todayLog.moodScore ?? 0) > 0) completedCount++;
    }
    if ((challenge as any).trackSleep) {
      totalCount++;
      const sleepGoalMinutes = ((challenge as any).sleepGoalHours ?? 8) * 60;
      if (todayLog.sleepCompleted || (todayLog.sleepMinutes ?? 0) >= sleepGoalMinutes) completedCount++;
    }
    
    const isAllComplete = totalCount > 0 && completedCount === totalCount;
    
    // Only trigger confetti when transitioning from incomplete to complete
    if (isAllComplete && !wasCompleteRef.current) {
      setShowConfetti(true);
    }
    wasCompleteRef.current = isAllComplete;
  }, [challenge, todayLog, steps, isAuthorized]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <Header name={user?.name} />
      
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
            colors={["#8B5CF6"]}
          />
        }
      >
        <View className="p-4">
          {/* Challenge Status Card */}
          <ChallengeStatusCard />

          {/* Activity Progress Cards */}
          {challenge && (() => {
            // Check if challenge has started
            const startDate = new Date(challenge.startDate);
            startDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const hasStarted = today >= startDate;
            
            if (!hasStarted) {
              return null; // Don't show progress section for future challenges
            }
            
            return (
              <View className="mt-2">
                <SectionHeader title="Today's Progress" icon="check-circle" />
                
                {/* Check if any activities are tracked */}
                {(() => {
                  const hasTrackedActivities = 
                    challenge.trackSteps || 
                    challenge.trackWorkout1 || 
                    challenge.trackWorkout2 || 
                    challenge.trackWater || 
                    challenge.trackReading || 
                    challenge.trackDiet || 
                    challenge.trackCalories ||
                    challenge.trackProgressPhoto || 
                    challenge.trackNoAlcohol ||
                    challenge.trackMood ||
                    challenge.trackWeight ||
                    (challenge as any).trackCycle ||
                    (challenge as any).trackSkincare;
                  
                  if (!hasTrackedActivities) {
                    return (
                      <Pressable
                        onPress={() => router.push("/challenge-setup")}
                        className="bg-white rounded-2xl p-6 border-2 border-dashed border-purple-200"
                      >
                        <EmptyStateIllustration />
                        <View className="items-center">
                          <Text className="text-lg font-semibold text-gray-800 mb-2">Ready to Start?</Text>
                          <Text className="text-sm text-gray-500 text-center mb-4">
                            Add activities to track your daily progress and build healthy habits!
                          </Text>
                          <View className="bg-purple-500 px-5 py-2.5 rounded-full flex-row items-center">
                            <Feather name="plus" size={16} color="white" />
                            <Text className="text-white font-semibold ml-1">Set Up Activities</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  }
                  
                  // Build list of tracked activities
                  type ActivityType = "steps" | "workout1" | "workout2" | "water" | "diet" | "reading" | "photo" | "alcohol" | "weight" | "mood" | "calories" | "cycle" | "sleep" | "skincare";
                  const trackedActivities: ActivityType[] = [];
                  
                  if (challenge.trackSteps) trackedActivities.push("steps");
                  if (challenge.trackWorkout1) trackedActivities.push("workout1");
                  if (challenge.trackWorkout2) trackedActivities.push("workout2");
                  if (challenge.trackWater) trackedActivities.push("water");
                  if (challenge.trackReading) trackedActivities.push("reading");
                  if (challenge.trackDiet) trackedActivities.push("diet");
                  if (challenge.trackCalories) trackedActivities.push("calories");
                  if (challenge.trackProgressPhoto) trackedActivities.push("photo");
                  if (challenge.trackNoAlcohol) trackedActivities.push("alcohol");
                  if (challenge.trackMood) trackedActivities.push("mood");
                  if (challenge.trackWeight) trackedActivities.push("weight");
                  if ((challenge as any).trackSleep) trackedActivities.push("sleep");
                  if ((challenge as any).trackCycle) trackedActivities.push("cycle");
                  if ((challenge as any).trackSkincare) trackedActivities.push("skincare");
                  
                  // Group into pairs for 2-column layout
                  const rows: ActivityType[][] = [];
                  for (let i = 0; i < trackedActivities.length; i += 2) {
                    rows.push(trackedActivities.slice(i, i + 2));
                  }
                  
                  return (
                    <>
                      {rows.map((row, index) => (
                        <View key={index} className="flex-row gap-3 mb-3">
                          {row.map((type) => (
                            <ActivityProgressCard key={type} type={type} compact />
                          ))}
                        </View>
                      ))}
                    </>
                  );
                })()}
              </View>
            );
          })()}
        </View>
      </ScrollView>
      
      {/* Confetti celebration overlay */}
      <ConfettiCelebration show={showConfetti} />
    </SafeAreaView>
  );
}
