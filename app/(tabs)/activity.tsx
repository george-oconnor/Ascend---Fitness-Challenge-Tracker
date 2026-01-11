import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ActivityLog, ActivityType } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import {
    format,
    isToday,
    isWithinInterval,
    isYesterday,
    parseISO,
    startOfWeek,
    subDays
} from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Activity type configurations for display
const ACTIVITY_CONFIG: Record<ActivityType, { icon: keyof typeof Feather.glyphMap; color: string; bgColor: string }> = {
  steps: { icon: "trending-up", color: "#10B981", bgColor: "#D1FAE5" },
  workout1: { icon: "zap", color: "#F59E0B", bgColor: "#FEF3C7" },
  workout2: { icon: "activity", color: "#8B5CF6", bgColor: "#EDE9FE" },
  water: { icon: "droplet", color: "#3B82F6", bgColor: "#DBEAFE" },
  diet: { icon: "check-circle", color: "#22C55E", bgColor: "#DCFCE7" },
  reading: { icon: "book-open", color: "#A855F7", bgColor: "#F3E8FF" },
  photo: { icon: "camera", color: "#EC4899", bgColor: "#FCE7F3" },
  alcohol: { icon: "slash", color: "#EF4444", bgColor: "#FEE2E2" },
  weight: { icon: "trending-down", color: "#6366F1", bgColor: "#E0E7FF" },
  mood: { icon: "smile", color: "#F59E0B", bgColor: "#FEF3C7" },
  calories: { icon: "pie-chart", color: "#14B8A6", bgColor: "#CCFBF1" },
  cycle: { icon: "heart", color: "#EC4899", bgColor: "#FCE7F3" },
  sleep: { icon: "moon", color: "#8B5CF6", bgColor: "#EDE9FE" },
  skincare: { icon: "sun", color: "#14B8A6", bgColor: "#CCFBF1" },
};

type GroupedActivity = {
  title: string;
  data: ActivityLog[];
};

export default function ActivityScreen() {
  const { user } = useSessionStore();
  const { challenge, activityLogs, fetchChallenge, fetchActivityLogs } = useChallengeStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id, fetchChallenge]);

  useEffect(() => {
    if (challenge?.$id) {
      fetchActivityLogs(challenge.$id);
    }
  }, [challenge?.$id, fetchActivityLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (challenge?.$id) {
        await fetchActivityLogs(challenge.$id);
      }
    } finally {
      setRefreshing(false);
    }
  }, [challenge?.$id, fetchActivityLogs]);



  // Group activities by date
  const groupedActivities = useMemo(() => {
    if (!activityLogs || activityLogs.length === 0) return [];

    const groups: GroupedActivity[] = [];
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const todayItems: ActivityLog[] = [];
    const yesterdayItems: ActivityLog[] = [];
    const thisWeekItems: ActivityLog[] = [];
    const earlierItems: ActivityLog[] = [];

    activityLogs.forEach((item) => {
      const itemDate = parseISO(item.$createdAt || item.date);
      if (isToday(itemDate)) {
        todayItems.push(item);
      } else if (isYesterday(itemDate)) {
        yesterdayItems.push(item);
      } else if (isWithinInterval(itemDate, { start: weekStart, end: subDays(now, 2) })) {
        thisWeekItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    if (todayItems.length > 0) groups.push({ title: "Today", data: todayItems });
    if (yesterdayItems.length > 0) groups.push({ title: "Yesterday", data: yesterdayItems });
    if (thisWeekItems.length > 0) groups.push({ title: "This Week", data: thisWeekItems });
    if (earlierItems.length > 0) groups.push({ title: "Earlier", data: earlierItems });

    return groups;
  }, [activityLogs]);

  const formatActivityDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return format(date, "h:mm a");
    return format(date, "MMM d, h:mm a");
  };

  const getActivityConfig = (type: ActivityType) => {
    return ACTIVITY_CONFIG[type] || { icon: "circle", color: "#6B7280", bgColor: "#F3F4F6" };
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Activity</Text>
        <Text className="text-sm text-gray-500 mt-1">Your recent activity feed</Text>
      </View>

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


        {/* Recent Activity Feed */}
        {groupedActivities.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8 mt-10">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
              <Feather name="activity" size={32} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">No Activity Yet</Text>
            <Text className="text-sm text-gray-500 text-center">
              Start tracking your daily activities to see your progress here!
            </Text>
          </View>
        ) : (
          <View className="p-4">
            <Text className="text-sm font-semibold text-gray-500 mb-3 ml-1">Recent Activity</Text>
            {groupedActivities.map((group) => (
              <View key={group.title} className="mb-6">
                <Text className="text-xs font-medium text-gray-400 mb-2 ml-1">
                  {group.title}
                </Text>
                <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  {group.data.slice(0, 5).map((item, index) => {
                    const config = getActivityConfig(item.type);
                    return (
                      <View
                        key={item.$id}
                        className={`flex-row items-center p-4 ${
                          index < Math.min(group.data.length, 5) - 1 ? "border-b border-gray-100" : ""
                        }`}
                      >
                        <View
                          className="h-10 w-10 items-center justify-center rounded-full mr-3"
                          style={{ backgroundColor: config.bgColor }}
                        >
                          <Feather name={config.icon} size={20} color={config.color} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900">
                            {item.title}
                          </Text>
                          <Text className="text-sm text-gray-500" numberOfLines={1}>{item.description}</Text>
                        </View>
                        <Text className="text-xs text-gray-400">
                          {formatActivityDate(item.$createdAt || item.date)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
