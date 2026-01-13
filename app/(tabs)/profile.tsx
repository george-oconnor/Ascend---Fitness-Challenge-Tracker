import { BADGES } from "@/constants/badges";
import { getUserBadges } from "@/lib/appwrite";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { BadgeId } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { user } = useSessionStore();
  const { challenge, allLogs } = useChallengeStore();
  const [savedBadgeIds, setSavedBadgeIds] = useState<BadgeId[]>([]);
  
  // Load saved badges from Appwrite
  useEffect(() => {
    const loadBadges = async () => {
      if (!user?.id) return;
      const badges = await getUserBadges(user.id);
      setSavedBadgeIds(badges.map(b => b.badgeId));
    };
    loadBadges();
  }, [user?.id]);

  // Calculate earned badges from logs
  const earnedBadges = useMemo(() => {
    if (!allLogs || !challenge) return [];
    
    const badges: BadgeId[] = [];
    const completedDays = allLogs.filter(log => {
      const workout1Done = !challenge.trackWorkout1 || log.workout1Completed;
      const workout2Done = !challenge.trackWorkout2 || log.workout2Completed;
      const waterDone = !challenge.trackWater || log.waterCompleted;
      const dietDone = !challenge.trackDiet || log.dietCompleted;
      const readingDone = !challenge.trackReading || log.readingCompleted;
      const photoDone = !challenge.trackProgressPhoto || log.progressPhotoCompleted;
      const alcoholDone = !challenge.trackNoAlcohol || log.noAlcoholCompleted;
      
      return workout1Done && workout2Done && waterDone && dietDone && readingDone && photoDone && alcoholDone;
    }).length;

    // Day milestones
    if (completedDays >= 1) badges.push("first_day");
    if (completedDays >= 7) badges.push("week_warrior");
    if (completedDays >= 30) badges.push("month_master");
    if (completedDays >= 50) badges.push("halfway_hero");
    if (completedDays >= 75) badges.push("champion");

    // Water badges
    const waterLogs = allLogs.filter(log => log.waterCompleted);
    if (waterLogs.length >= 7) badges.push("hydration_week");
    if (waterLogs.length >= 30) badges.push("hydration_hero");

    // Workout badges
    const workout1Logs = allLogs.filter(log => log.workout1Completed);
    if (workout1Logs.length >= 10) badges.push("workout_starter");
    if (workout1Logs.length >= 50) badges.push("fitness_fanatic");

    // Reading badges
    const readingLogs = allLogs.filter(log => log.readingCompleted);
    if (readingLogs.length >= 7) badges.push("bookworm_week");
    if (readingLogs.some(log => log.finishedBook)) badges.push("page_turner");

    // Sobriety badges
    const alcoholLogs = allLogs.filter(log => log.noAlcoholCompleted);
    if (alcoholLogs.length >= 7) badges.push("sober_week");
    if (alcoholLogs.length >= 30) badges.push("clean_living");

    return badges as BadgeId[];
  }, [allLogs, challenge]);

  const allEarnedBadges = useMemo(() => {
    const combined = new Set([...savedBadgeIds, ...earnedBadges]);
    return Array.from(combined) as BadgeId[];
  }, [savedBadgeIds, earnedBadges]);
  
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-900">Profile</Text>
        <Pressable 
          onPress={() => router.push("/settings")}
          className="h-8 w-8 items-center justify-center rounded-full bg-orange-100"
        >
          <Feather name="settings" size={20} color="#F97316" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View className="bg-white px-5 py-6 items-center border-b border-gray-100">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-purple-500 mb-3">
            <Text className="text-4xl font-bold text-white">
              {initials}
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">
            {user?.name || "Unknown"}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {user?.email || "No email"}
          </Text>
          {challenge && (
            <View className="flex-row items-center mt-3 bg-purple-100 px-3 py-1.5 rounded-full">
              <Feather name="zap" size={14} color="#8B5CF6" />
              <Text className="text-sm font-semibold text-purple-600 ml-1.5">
                {challenge.totalDays || 75} Day Challenge
              </Text>
            </View>
          )}
        </View>

        {/* Milestones & Badges */}
        <View className="m-4">
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm font-semibold text-gray-600">Milestones</Text>
              <Text className="text-xs text-gray-400">{allEarnedBadges.length} earned</Text>
            </View>
            {allEarnedBadges.length > 0 ? (
              <View className="flex-row flex-wrap gap-3">
                {allEarnedBadges.map((badgeId) => {
                  const badge = BADGES[badgeId];
                  return (
                    <View key={badgeId} className="items-center" style={{ width: 70 }}>
                      <View 
                        className="h-12 w-12 rounded-full items-center justify-center mb-1"
                        style={{ backgroundColor: badge.bgColor }}
                      >
                        <Feather name={badge.icon as keyof typeof Feather.glyphMap} size={20} color={badge.color} />
                      </View>
                      <Text className="text-xs text-gray-600 text-center" numberOfLines={2}>
                        {badge.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="items-center py-4">
                <View className="h-12 w-12 rounded-full items-center justify-center bg-gray-100 mb-2">
                  <Feather name="award" size={20} color="#9CA3AF" />
                </View>
                <Text className="text-sm text-gray-400 text-center">
                  Complete activities to earn badges!
                </Text>
              </View>
            )}
          </View>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}
