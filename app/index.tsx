import ChallengeStatusCard from "@/components/ChallengeStatusCard";
import Header from "@/components/Header";
import ProgressSummaryCard from "@/components/ProgressSummaryCard";
import StepsCard from "@/components/StepsCard";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useHealthStore } from "@/store/useHealthStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useCallback, useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
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

          {/* Progress Summary Card */}
          <ProgressSummaryCard />

          {/* Steps Card - shows live Apple Health data */}
          <StepsCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
