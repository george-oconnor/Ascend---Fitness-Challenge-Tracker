import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ActivityLog, ActivityType, DailyLog } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import {
    differenceInDays,
    eachDayOfInterval,
    format,
    isToday,
    isWithinInterval,
    isYesterday,
    parseISO,
    startOfWeek,
    subDays
} from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
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
  const { challenge, activityLogs, allLogs, fetchChallenge, fetchActivityLogs, fetchAllLogs } = useChallengeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  
  // Handle date param from analytics navigation
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id, fetchChallenge]);

  useEffect(() => {
    if (challenge?.$id) {
      fetchActivityLogs(challenge.$id);
      fetchAllLogs(challenge.$id);
    }
  }, [challenge?.$id, fetchActivityLogs, fetchAllLogs]);

  // Handle date param from analytics navigation - open modal for that date
  useEffect(() => {
    if (dateParam && allLogs) {
      try {
        const date = parseISO(dateParam);
        setSelectedDate(date);
        setShowDayModal(true);
      } catch (e) {
        console.warn("Invalid date param:", dateParam);
      }
    }
  }, [dateParam, allLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (challenge?.$id) {
        await Promise.all([
          fetchActivityLogs(challenge.$id),
          fetchAllLogs(challenge.$id)
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [challenge?.$id, fetchActivityLogs, fetchAllLogs]);

  // Generate calendar days for the current challenge period
  const calendarDays = useMemo(() => {
    if (!challenge?.startDate) return [];
    
    const start = parseISO(challenge.startDate);
    const today = new Date();
    const end = today; // Show up to today
    
    // Start from the beginning of the week that contains the start date
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: calendarStart, end });
  }, [challenge?.startDate]);

  // Get log for a specific date
  const getLogForDate = useCallback((date: Date): DailyLog | undefined => {
    if (!allLogs) return undefined;
    const dateStr = format(date, "yyyy-MM-dd");
    return allLogs.find((log: DailyLog) => format(parseISO(log.date), "yyyy-MM-dd") === dateStr);
  }, [allLogs]);

  // Get activities for a specific date
  const getActivitiesForDate = useCallback((date: Date): ActivityLog[] => {
    if (!activityLogs) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return activityLogs.filter((log: ActivityLog) => {
      const logDate = format(parseISO(log.date), "yyyy-MM-dd");
      return logDate === dateStr;
    });
  }, [activityLogs]);

  // Check if a day has any completed activity
  const hasActivityOnDate = useCallback((date: Date): boolean => {
    const log = getLogForDate(date);
    if (!log) return false;
    return !!(
      log.workout1Completed || log.workout2Completed ||
      log.dietCompleted || log.waterCompleted ||
      log.readingCompleted || log.progressPhotoCompleted ||
      log.stepsCompleted ||
      (log.stepsCount && log.stepsCount > 0) ||
      (log.workout1Minutes && log.workout1Minutes > 0) ||
      (log.workout2Minutes && log.workout2Minutes > 0) ||
      (log.waterLiters && log.waterLiters > 0) ||
      (log.readingPages && log.readingPages > 0)
    );
  }, [getLogForDate]);

  // Calculate day number in challenge
  const getDayNumber = useCallback((date: Date): number | null => {
    if (!challenge?.startDate) return null;
    const start = parseISO(challenge.startDate);
    const diff = differenceInDays(date, start);
    if (diff < 0) return null;
    return diff + 1;
  }, [challenge?.startDate]);

  // Selected day's data
  const selectedDayLog = useMemo((): DailyLog | null => {
    if (!selectedDate) return null;
    return getLogForDate(selectedDate) || null;
  }, [selectedDate, getLogForDate]);

  const selectedDayActivities = useMemo(() => {
    if (!selectedDate) return [];
    return getActivitiesForDate(selectedDate);
  }, [selectedDate, getActivitiesForDate]);

  const handleDayPress = (date: Date) => {
    setSelectedDate(date);
    setShowDayModal(true);
  };

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

  // Completion status for day modal
  const getCompletionItems = (log: DailyLog | null) => {
    if (!log || !challenge) return [];
    
    const items: { label: string; completed: boolean; value?: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [];
    
    if (challenge.trackSteps) {
      items.push({
        label: "Steps",
        completed: log.stepsCompleted || (log.stepsCount !== undefined && log.stepsCount >= (challenge.stepsGoal || 10000)),
        value: log.stepsCount ? `${log.stepsCount.toLocaleString()} steps` : undefined,
        icon: "trending-up",
        color: "#10B981"
      });
    }
    
    if (challenge.trackWorkout1) {
      items.push({
        label: "Workout 1",
        completed: log.workout1Completed || (log.workout1Minutes !== undefined && log.workout1Minutes >= (challenge.workoutMinutes || 45)),
        value: log.workout1Minutes ? `${log.workout1Minutes} min` : undefined,
        icon: "zap",
        color: "#F59E0B"
      });
    }
    
    if (challenge.trackWorkout2) {
      items.push({
        label: "Workout 2",
        completed: log.workout2Completed || (log.workout2Minutes !== undefined && log.workout2Minutes >= (challenge.workoutMinutes || 45)),
        value: log.workout2Minutes ? `${log.workout2Minutes} min` : undefined,
        icon: "activity",
        color: "#8B5CF6"
      });
    }
    
    if (challenge.trackWater) {
      items.push({
        label: "Water",
        completed: log.waterCompleted || (log.waterLiters !== undefined && log.waterLiters >= (challenge.waterLiters || 3.7)),
        value: log.waterLiters ? `${log.waterLiters}L` : undefined,
        icon: "droplet",
        color: "#3B82F6"
      });
    }
    
    if (challenge.trackDiet) {
      items.push({
        label: "Diet",
        completed: !!log.dietCompleted,
        icon: "check-circle",
        color: "#22C55E"
      });
    }
    
    if (challenge.trackReading) {
      items.push({
        label: "Reading",
        completed: log.readingCompleted || (log.readingPages !== undefined && log.readingPages >= (challenge.readingPages || 10)),
        value: log.readingPages ? `${log.readingPages} pages` : undefined,
        icon: "book-open",
        color: "#A855F7"
      });
    }
    
    if (challenge.trackProgressPhoto) {
      items.push({
        label: "Progress Photo",
        completed: !!log.progressPhotoCompleted,
        icon: "camera",
        color: "#EC4899"
      });
    }
    
    if (challenge.trackNoAlcohol) {
      items.push({
        label: "No Alcohol",
        completed: !!log.noAlcoholCompleted,
        icon: "slash",
        color: "#EF4444"
      });
    }
    
    if (challenge.trackSkincare) {
      items.push({
        label: "Skincare",
        completed: !!log.skincareCompleted,
        icon: "sun",
        color: "#14B8A6"
      });
    }
    
    if (challenge.trackCalories && log.caloriesConsumed) {
      items.push({
        label: "Calories",
        completed: true,
        value: `${log.caloriesConsumed} cal`,
        icon: "pie-chart",
        color: "#14B8A6"
      });
    }
    
    if (challenge.trackWeight && log.currentWeight) {
      items.push({
        label: "Weight",
        completed: true,
        value: `${log.currentWeight} kg`,
        icon: "trending-down",
        color: "#6366F1"
      });
    }
    
    if (challenge.trackMood && log.moodScore) {
      const moodEmojis = ["😢", "😕", "😐", "🙂", "😄"];
      items.push({
        label: "Mood",
        completed: true,
        value: moodEmojis[log.moodScore - 1] || "😐",
        icon: "smile",
        color: "#F59E0B"
      });
    }
    
    if (challenge.trackSleep && log.sleepMinutes) {
      const hours = Math.floor(log.sleepMinutes / 60);
      const mins = log.sleepMinutes % 60;
      items.push({
        label: "Sleep",
        completed: true,
        value: `${hours}h ${mins}m`,
        icon: "moon",
        color: "#8B5CF6"
      });
    }
    
    return items;
  };

  // Group calendar days by week
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    
    calendarDays.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === calendarDays.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return weeks;
  }, [calendarDays]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Activity</Text>
        <Text className="text-sm text-gray-500 mt-1">Tap a day to see details</Text>
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
        {/* Calendar Grid */}
        {calendarDays.length > 0 && (
          <View className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-600 mb-3">Challenge Calendar</Text>
            
            {/* Day headers */}
            <View className="flex-row mb-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <View key={day} className="flex-1 items-center">
                  <Text className="text-xs text-gray-400">{day}</Text>
                </View>
              ))}
            </View>
            
            {/* Calendar weeks */}
            {calendarWeeks.map((week, weekIndex) => (
              <View key={weekIndex} className="flex-row mb-1">
                {week.map((day, dayIndex) => {
                  const dayNumber = getDayNumber(day);
                  const hasActivity = hasActivityOnDate(day);
                  const isTodayDate = isToday(day);
                  const isFuture = day > new Date();
                  const isBeforeChallenge = dayNumber === null;
                  
                  return (
                    <TouchableOpacity
                      key={dayIndex}
                      className="flex-1 items-center py-1"
                      onPress={() => !isFuture && !isBeforeChallenge && handleDayPress(day)}
                      disabled={isFuture || isBeforeChallenge}
                    >
                      <View 
                        className={`h-9 w-9 rounded-full items-center justify-center ${
                          isTodayDate ? "border-2 border-purple-500" : ""
                        } ${
                          hasActivity ? "bg-purple-500" : 
                          isBeforeChallenge || isFuture ? "bg-transparent" : "bg-gray-100"
                        }`}
                      >
                        <Text 
                          className={`text-xs font-medium ${
                            hasActivity ? "text-white" : 
                            isBeforeChallenge || isFuture ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          {format(day, "d")}
                        </Text>
                      </View>
                      {dayNumber && dayNumber <= (challenge?.totalDays || 75) && (
                        <Text className="text-[10px] text-gray-400 mt-0.5">
                          D{dayNumber}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {/* Fill remaining days in last week */}
                {week.length < 7 && Array(7 - week.length).fill(null).map((_, i) => (
                  <View key={`empty-${i}`} className="flex-1" />
                ))}
              </View>
            ))}
          </View>
        )}

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

      {/* Day Detail Modal */}
      <Modal
        visible={showDayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDayModal(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          {/* Modal Header */}
          <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-bold text-gray-900">
                {selectedDate ? format(selectedDate, "EEEE, MMM d") : ""}
              </Text>
              {selectedDate && getDayNumber(selectedDate) && (
                <Text className="text-sm text-purple-500">
                  Day {getDayNumber(selectedDate)} of {challenge?.totalDays || 75}
                </Text>
              )}
            </View>
            <Pressable 
              onPress={() => setShowDayModal(false)}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
            >
              <Feather name="x" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Completion Status */}
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-4">Completions</Text>
              {getCompletionItems(selectedDayLog).length > 0 ? (
                <View>
                  {getCompletionItems(selectedDayLog).map((item, index) => (
                    <View 
                      key={item.label} 
                      className={`flex-row items-center py-3 ${
                        index < getCompletionItems(selectedDayLog).length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      <View 
                        className="h-10 w-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: item.completed ? `${item.color}20` : "#F3F4F6" }}
                      >
                        <Feather 
                          name={item.icon} 
                          size={20} 
                          color={item.completed ? item.color : "#9CA3AF"} 
                        />
                      </View>
                      <View className="flex-1">
                        <Text className={`font-medium ${item.completed ? "text-gray-900" : "text-gray-400"}`}>
                          {item.label}
                        </Text>
                        {item.value && (
                          <Text className="text-sm text-gray-500">{item.value}</Text>
                        )}
                      </View>
                      <View 
                        className={`h-6 w-6 rounded-full items-center justify-center ${
                          item.completed ? "bg-green-500" : "bg-gray-200"
                        }`}
                      >
                        <Feather 
                          name={item.completed ? "check" : "x"} 
                          size={14} 
                          color={item.completed ? "white" : "#9CA3AF"} 
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="items-center py-6">
                  <Feather name="calendar" size={32} color="#9CA3AF" />
                  <Text className="text-sm text-gray-400 mt-2">No data logged for this day</Text>
                </View>
              )}
            </View>

            {/* Notes & Details */}
            {selectedDayLog?.notes && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">Notes</Text>
                <Text className="text-gray-700">{selectedDayLog.notes}</Text>
              </View>
            )}

            {selectedDayLog?.workoutDetails && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">Workout Details</Text>
                <Text className="text-gray-700">{selectedDayLog.workoutDetails}</Text>
              </View>
            )}

            {selectedDayLog?.moodNotes && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">Mood Notes</Text>
                <Text className="text-gray-700">{selectedDayLog.moodNotes}</Text>
              </View>
            )}

            {/* Activity Log for this day */}
            {selectedDayActivities.length > 0 && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-4">Activity Log</Text>
                {selectedDayActivities.map((activity, index) => {
                  const config = getActivityConfig(activity.type);
                  return (
                    <View 
                      key={activity.$id}
                      className={`flex-row items-center py-3 ${
                        index < selectedDayActivities.length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full mr-3"
                        style={{ backgroundColor: config.bgColor }}
                      >
                        <Feather name={config.icon} size={20} color={config.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium text-gray-900">{activity.title}</Text>
                        <Text className="text-sm text-gray-500">{activity.description}</Text>
                      </View>
                      <Text className="text-xs text-gray-400">
                        {format(parseISO(activity.$createdAt || activity.date), "h:mm a")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
