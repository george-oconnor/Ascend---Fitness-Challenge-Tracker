import ActivityProgressCard from "@/components/ActivityProgressCard";
import ChallengeStatusCard from "@/components/ChallengeStatusCard";
import Header from "@/components/Header";
import StepsCard from "@/components/StepsCard";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { user } = useSessionStore();
  const { challenge, todayLog, fetchChallenge, syncHealthData } = useChallengeStore();
  const { isAuthorized, fetchTodayData, steps, workouts } = useHealthStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh challenge data
      if (user?.id) {
        await fetchChallenge(user.id);
      }
      
      // Sync health data from Apple Health if available
      if (Platform.OS === "ios" && isAuthorized) {
        await fetchTodayData();
        // Sync health data to daily log
        if (challenge?.$id && todayLog?.$id) {
          await syncHealthData();
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, isAuthorized, challenge?.$id, todayLog?.$id, fetchChallenge, fetchTodayData, syncHealthData]);

  // Auto-sync health data when it changes
  useEffect(() => {
    if (Platform.OS === "ios" && isAuthorized && challenge?.$id && todayLog?.$id) {
      syncHealthData();
    }
  }, [steps, workouts, isAuthorized, challenge?.$id, todayLog?.$id]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
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
                <Text className="text-sm font-semibold text-gray-600 mb-3 ml-1">Today's Progress</Text>
                
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
                    (challenge as any).trackCycle;
                  
                  if (!hasTrackedActivities) {
                    return (
                      <Pressable
                        onPress={() => router.push("/challenge-setup")}
                        className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-gray-200"
                      >
                        <View className="items-center">
                          <View className="h-16 w-16 items-center justify-center rounded-full bg-purple-100 mb-4">
                            <Feather name="plus-circle" size={32} color="#8B5CF6" />
                          </View>
                          <Text className="text-lg font-semibold text-gray-800 mb-2">No Activities Tracked</Text>
                          <Text className="text-sm text-gray-500 text-center mb-4">
                            Add some activities to track your daily progress and build healthy habits!
                          </Text>
                          <View className="bg-purple-500 px-4 py-2 rounded-full">
                            <Text className="text-white font-semibold">Set Up Activities</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  }
                  
                  // Build list of tracked activities
                  type ActivityType = "steps" | "workout1" | "workout2" | "water" | "diet" | "reading" | "photo" | "alcohol" | "weight" | "mood" | "calories" | "cycle";
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

          {/* Steps Card - shows live Apple Health connection */}
          <StepsCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
