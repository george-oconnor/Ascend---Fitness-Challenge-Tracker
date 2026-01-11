import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { DailyLog } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import { differenceInDays, eachDayOfInterval, format, parseISO, startOfWeek, subDays } from "date-fns";
import { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AnalyticsScreen() {
  const { user } = useSessionStore();
  const { challenge, allLogs, fetchChallenge, fetchAllLogs } = useChallengeStore();

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id, fetchChallenge]);

  useEffect(() => {
    if (challenge?.$id) {
      fetchAllLogs(challenge.$id);
    }
  }, [challenge?.$id, fetchAllLogs]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!allLogs || allLogs.length === 0 || !challenge) {
      return null;
    }

    const startDate = parseISO(challenge.startDate);
    const today = new Date();
    const challengeTotalDays = challenge.totalDays || 75;
    
    // Days elapsed since start (including today as in-progress)
    const daysElapsed = differenceInDays(today, startDate) + 1;
    
    // Days actually completed = days elapsed - 1 (today is still in progress)
    // But also count today if there's a log with activity
    const todayStr = format(today, "yyyy-MM-dd");
    const todayLog = allLogs.find((l: DailyLog) => format(parseISO(l.date), "yyyy-MM-dd") === todayStr);
    const todayHasActivity = todayLog && (
      todayLog.workout1Completed || todayLog.workout2Completed ||
      todayLog.dietCompleted || todayLog.waterCompleted ||
      todayLog.readingCompleted || todayLog.progressPhotoCompleted ||
      todayLog.stepsCompleted
    );
    
    // Count days with any completed activity
    const daysWithActivity = allLogs.filter((log: DailyLog) => 
      log.workout1Completed || log.workout2Completed ||
      log.dietCompleted || log.waterCompleted ||
      log.readingCompleted || log.progressPhotoCompleted ||
      log.stepsCompleted ||
      // Also consider logged values as activity
      (log.stepsCount && log.stepsCount > 0) ||
      (log.workout1Minutes && log.workout1Minutes > 0) ||
      (log.workout2Minutes && log.workout2Minutes > 0) ||
      (log.waterLiters && log.waterLiters > 0) ||
      (log.readingPages && log.readingPages > 0)
    ).length;
    
    // Completed days = days with actual completed tasks (not just logs existing)
    const completedDays = daysWithActivity;

    // Calculate streak
    let currentStreak = 0;
    const sortedLogs = [...allLogs].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log("📊 Streak calculation:", {
      todayStr,
      sortedLogDates: sortedLogs.map(l => l.date),
    });
    
    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const logDate = parseISO(log.date);
      const expectedDate = subDays(today, i);
      const expectedDateStr = format(expectedDate, "yyyy-MM-dd");
      const logDateStr = format(logDate, "yyyy-MM-dd");
      
      // Check if this log has any activity (completed OR logged values)
      const hasActivity = 
        log.workout1Completed || log.workout2Completed ||
        log.dietCompleted || log.waterCompleted ||
        log.readingCompleted || log.progressPhotoCompleted ||
        log.stepsCompleted ||
        // Also consider logged values as activity
        (log.stepsCount && log.stepsCount > 0) ||
        (log.workout1Minutes && log.workout1Minutes > 0) ||
        (log.workout2Minutes && log.workout2Minutes > 0) ||
        (log.waterLiters && log.waterLiters > 0) ||
        (log.readingPages && log.readingPages > 0);
      
      console.log(`📊 Streak check day ${i}: logDate=${logDateStr}, expected=${expectedDateStr}, match=${logDateStr === expectedDateStr}, hasActivity=${hasActivity}`);
      
      if (logDateStr === expectedDateStr && hasActivity) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    console.log("📊 Final streak:", currentStreak);

    // Calculate averages
    const totalSteps = allLogs.reduce((sum: number, log: DailyLog) => sum + (log.stepsCount || 0), 0);
    const totalWater = allLogs.reduce((sum: number, log: DailyLog) => sum + (log.waterLiters || 0), 0);
    const totalReading = allLogs.reduce((sum: number, log: DailyLog) => sum + (log.readingPages || 0), 0);
    const totalWorkoutTime = allLogs.reduce((sum: number, log: DailyLog) => 
      sum + (log.workout1Minutes || 0) + (log.workout2Minutes || 0), 0
    );

    // Completion rates
    const workoutCompletions = allLogs.filter((log: DailyLog) => 
      (log.workout1Minutes && log.workout1Minutes > 0) || (log.workout2Minutes && log.workout2Minutes > 0)
    ).length;
    const dietCompletions = allLogs.filter((log: DailyLog) => log.dietCompleted).length;
    const photoCompletions = allLogs.filter((log: DailyLog) => log.progressPhotoCompleted).length;

    // Use days elapsed for rate calculations (how many days have passed)
    // Use challenge total days for the "X / Y" display
    return {
      completedDays,
      totalDays: challengeTotalDays,
      completionRate: daysElapsed > 0 ? Math.min(100, Math.round((completedDays / daysElapsed) * 100)) : 0,
      currentStreak,
      avgSteps: completedDays > 0 ? Math.round(totalSteps / completedDays) : 0,
      avgWater: completedDays > 0 ? (totalWater / completedDays).toFixed(1) : "0",
      avgReading: completedDays > 0 ? Math.round(totalReading / completedDays) : 0,
      totalWorkoutTime,
      workoutRate: daysElapsed > 0 ? Math.min(100, Math.round((workoutCompletions / daysElapsed) * 100)) : 0,
      dietRate: daysElapsed > 0 ? Math.min(100, Math.round((dietCompletions / daysElapsed) * 100)) : 0,
      photoRate: daysElapsed > 0 ? Math.min(100, Math.round((photoCompletions / daysElapsed) * 100)) : 0,
    };
  }, [allLogs, challenge]);

  // Weekly activity data for chart
  const weeklyData = useMemo(() => {
    if (!allLogs) return [];

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: today });

    console.log("📊 Analytics weeklyData:", {
      today: format(today, "yyyy-MM-dd"),
      weekStart: format(weekStart, "yyyy-MM-dd"),
      daysCount: days.length,
      allLogsCount: allLogs.length,
      allLogDates: allLogs.map((l: DailyLog) => l.date),
    });

    return days.map((day: Date) => {
      const dayStr = format(day, "yyyy-MM-dd");
      // Parse the log date to compare properly (log.date might be ISO string)
      const log = allLogs.find((l: DailyLog) => {
        const logDateStr = format(parseISO(l.date), "yyyy-MM-dd");
        return logDateStr === dayStr;
      });
      
      // Check if log exists for this day
      const hasLog = !!log;
      
      // Check if any activity was completed (not just logged)
      const hasCompletedActivity = log && (
        log.workout1Completed || log.workout2Completed ||
        log.dietCompleted || log.waterCompleted ||
        log.readingCompleted || log.progressPhotoCompleted ||
        log.stepsCompleted ||
        // Also consider logged values as activity
        (log.stepsCount && log.stepsCount > 0) ||
        (log.workout1Minutes && log.workout1Minutes > 0) ||
        (log.workout2Minutes && log.workout2Minutes > 0) ||
        (log.waterLiters && log.waterLiters > 0) ||
        (log.readingPages && log.readingPages > 0)
      );

      console.log(`📊 Day ${dayStr}: hasLog=${hasLog}, hasActivity=${hasCompletedActivity}`, log ? {
        workout1Completed: log.workout1Completed,
        dietCompleted: log.dietCompleted,
        waterCompleted: log.waterCompleted,
        stepsCount: log.stepsCount,
        workout1Minutes: log.workout1Minutes,
        waterLiters: log.waterLiters,
      } : 'no log');

      return {
        day: format(day, "EEE"),
        date: format(day, "d"),
        completed: hasCompletedActivity,
        steps: log?.stepsCount || 0,
      };
    });
  }, [allLogs]);

  const StatCard = ({ 
    icon, 
    label, 
    value, 
    unit, 
    color, 
    bgColor 
  }: { 
    icon: keyof typeof Feather.glyphMap;
    label: string;
    value: string | number;
    unit?: string;
    color: string;
    bgColor: string;
  }) => (
    <View className="bg-white rounded-2xl p-4 shadow-sm flex-1">
      <View className="flex-row items-center mb-2">
        <View 
          className="h-8 w-8 items-center justify-center rounded-full mr-2"
          style={{ backgroundColor: bgColor }}
        >
          <Feather name={icon} size={16} color={color} />
        </View>
        <Text className="text-xs text-gray-500 flex-1">{label}</Text>
      </View>
      <View className="flex-row items-baseline">
        <Text className="text-2xl font-bold text-gray-900">{value}</Text>
        {unit && <Text className="text-sm text-gray-500 ml-1">{unit}</Text>}
      </View>
    </View>
  );

  const ProgressBar = ({ 
    label, 
    value, 
    color 
  }: { 
    label: string; 
    value: number; 
    color: string;
  }) => (
    <View className="mb-4">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-gray-600">{label}</Text>
        <Text className="text-sm font-semibold text-gray-900">{value}%</Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <View 
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Analytics</Text>
        <Text className="text-sm text-gray-500 mt-1">Track your progress and insights</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {!stats ? (
          <View className="flex-1 items-center justify-center p-8 mt-20">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-gray-100 mb-4">
              <Feather name="bar-chart-2" size={40} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-semibold text-gray-800 mb-2">No Data Yet</Text>
            <Text className="text-sm text-gray-500 text-center">
              Start logging your activities to see analytics and insights!
            </Text>
          </View>
        ) : (
          <View className="p-4">
            {/* Overview Cards */}
            <View className="flex-row gap-3 mb-4">
              <StatCard
                icon="calendar"
                label="Days Completed"
                value={stats.completedDays}
                unit={`/ ${stats.totalDays}`}
                color="#8B5CF6"
                bgColor="#EDE9FE"
              />
              <StatCard
                icon="zap"
                label="Current Streak"
                value={stats.currentStreak}
                unit="days"
                color="#F59E0B"
                bgColor="#FEF3C7"
              />
            </View>

            {/* Weekly Activity */}
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-4">This Week</Text>
              <View className="flex-row justify-between">
                {weeklyData.map((day, index) => (
                  <View key={index} className="items-center">
                    <Text className="text-xs text-gray-400 mb-2">{day.day}</Text>
                    <View 
                      className={`h-10 w-10 rounded-full items-center justify-center ${
                        day.completed ? "bg-purple-500" : "bg-gray-100"
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${
                        day.completed ? "text-white" : "text-gray-400"
                      }`}>
                        {day.date}
                      </Text>
                    </View>
                    {day.completed && (
                      <Feather name="check" size={12} color="#10B981" style={{ marginTop: 4 }} />
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Averages */}
            <Text className="text-sm font-semibold text-gray-500 mb-3 ml-1">Daily Averages</Text>
            <View className="flex-row gap-3 mb-4">
              <StatCard
                icon="activity"
                label="Avg Steps"
                value={stats.avgSteps.toLocaleString()}
                color="#10B981"
                bgColor="#D1FAE5"
              />
              <StatCard
                icon="droplet"
                label="Avg Water"
                value={stats.avgWater}
                unit="L"
                color="#3B82F6"
                bgColor="#DBEAFE"
              />
            </View>
            <View className="flex-row gap-3 mb-4">
              <StatCard
                icon="book-open"
                label="Avg Reading"
                value={stats.avgReading}
                unit="min"
                color="#8B5CF6"
                bgColor="#EDE9FE"
              />
              <StatCard
                icon="clock"
                label="Total Workout"
                value={stats.totalWorkoutTime}
                unit="min"
                color="#F59E0B"
                bgColor="#FEF3C7"
              />
            </View>

            {/* Completion Rates */}
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <Text className="text-sm font-semibold text-gray-600 mb-4">Completion Rates</Text>
              <ProgressBar label="Overall" value={stats.completionRate} color="#8B5CF6" />
              <ProgressBar label="Workouts" value={stats.workoutRate} color="#F59E0B" />
              <ProgressBar label="Diet" value={stats.dietRate} color="#10B981" />
              <ProgressBar label="Photos" value={stats.photoRate} color="#EC4899" />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
