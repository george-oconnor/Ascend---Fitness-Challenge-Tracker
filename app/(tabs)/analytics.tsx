import { BADGES } from "@/constants/badges";
import { createUserBadge, getUserBadges } from "@/lib/appwrite";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { ActivityLog, ActivityType, BadgeId, DailyLog, UserBadge } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import { addDays, differenceInDays, eachDayOfInterval, format, isAfter, isBefore, parseISO, startOfWeek, subDays } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
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

export default function AnalyticsScreen() {
  const { user } = useSessionStore();
  const { challenge, allLogs, activityLogs, fetchChallenge, fetchAllLogs, fetchActivityLogs, resyncHealthDataForDate } = useChallengeStore();
  const [savedBadges, setSavedBadges] = useState<UserBadge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = previous week, +1 = next week
  const [resyncing, setResyncing] = useState(false);
  const [resyncLogs, setResyncLogs] = useState<string[]>([]);
  const [showResyncModal, setShowResyncModal] = useState(false);
  
  // Handle date param from analytics navigation
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

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

  const getActivityConfig = (type: ActivityType) => {
    return ACTIVITY_CONFIG[type] || { icon: "circle", color: "#6B7280", bgColor: "#F3F4F6" };
  };

  // Handle re-sync from Apple Health
  const handleResyncHealthData = async () => {
    if (!selectedDate || !selectedDayLog?.$id || !challenge?.$id || resyncing) return;
    
    console.log('🔄 Starting resync, showing modal...');
    setResyncing(true);
    setResyncLogs([]);
    setShowResyncModal(true);
    
    const addLog = (message: string) => {
      console.log('📝 Adding log:', message);
      setResyncLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };
    
    try {
      addLog('🔄 Starting health data resync...');
      await resyncHealthDataForDate(selectedDate, selectedDayLog.$id, addLog);
      addLog('✅ Resync complete!');
      
      // Refresh to show updated data
      addLog('📥 Refreshing logs...');
      await fetchAllLogs(challenge.$id);
      await fetchActivityLogs(challenge.$id);
      addLog('✅ Logs refreshed!');
      
      // Update the selected day log with fresh data
      if (selectedDate) {
        const updatedLogs = useChallengeStore.getState().allLogs;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const updatedLog = updatedLogs.find(log => log.date === dateStr);
        if (updatedLog) {
          setSelectedDayLog(updatedLog);
          addLog('🔄 Display updated with fresh data');
        }
      }
      
      addLog('👆 Tap Close when ready');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Error: ${errorMsg}`);
      console.error("Failed to re-sync health data:", error);
    } finally {
      setResyncing(false);
    }
  };

  // Parse mood notes (could be JSON or plain text)
  const parseMoodNotes = (moodNotes: string | undefined) => {
    if (!moodNotes) return null;
    
    try {
      // Check if it's JSON with emotions structure
      if (moodNotes.startsWith('{"emotions":')) {
        const parsed = JSON.parse(moodNotes);
        const emotions = parsed.emotions || [];
        const notes = parsed.notes || "";
        
        return {
          emotions,
          notes,
          isStructured: true
        };
      } else {
        // Plain text notes
        return {
          emotions: [],
          notes: moodNotes,
          isStructured: false
        };
      }
    } catch {
      // If JSON parsing fails, treat as plain text
      return {
        emotions: [],
        notes: moodNotes,
        isStructured: false
      };
    }
  };

  // Parse meal data from JSON string
  const parseMealData = (mealsString: string | undefined) => {
    if (!mealsString) return null;
    
    try {
      const meals = JSON.parse(mealsString);
      const mealTypes: { key: string; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
        { key: 'breakfast', label: 'Breakfast', icon: 'sunrise', color: '#F97316' },
        { key: 'lunch', label: 'Lunch', icon: 'sun', color: '#EAB308' },
        { key: 'dinner', label: 'Dinner', icon: 'moon', color: '#8B5CF6' },
        { key: 'snacks', label: 'Snacks', icon: 'coffee', color: '#10B981' },
      ];
      
      return mealTypes
        .filter(meal => meals[meal.key] && meals[meal.key].trim())
        .map(meal => ({
          ...meal,
          content: meals[meal.key]
        }));
    } catch {
      // If parsing fails, treat as legacy general notes
      if (mealsString.trim()) {
        return [{ key: 'general', label: 'Diet Notes', icon: 'utensils' as keyof typeof Feather.glyphMap, color: '#6B7280', content: mealsString }];
      }
      return null;
    }
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

  // Load saved badges from Appwrite
  const loadBadges = useCallback(async () => {
    if (!user?.id) return;
    setBadgesLoading(true);
    try {
      const badges = await getUserBadges(user.id);
      setSavedBadges(badges);
    } catch (err) {
      console.error("Failed to load badges:", err);
    } finally {
      setBadgesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
      loadBadges();
    }
  }, [user?.id, fetchChallenge, loadBadges]);

  useEffect(() => {
    if (challenge?.$id) {
      fetchAllLogs(challenge.$id);
      fetchActivityLogs(challenge.$id);
    }
  }, [challenge?.$id, fetchAllLogs, fetchActivityLogs]);

  // Handle date param - open modal for that date
  useEffect(() => {
    if (dateParam && allLogs) {
      try {
        const date = parseISO(dateParam);
        setSelectedDate(date);
        setShowDayModal(true);
      } catch {
        // Silent catch - date param was invalid
      }
    }
  }, [dateParam, allLogs]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!allLogs || allLogs.length === 0 || !challenge) {
      return null;
    }

    const startDate = parseISO(challenge.startDate);
    const today = new Date();
    const challengeTotalDays = challenge.totalDays || 75;
    const challengeEndDate = addDays(startDate, challengeTotalDays - 1);
    
    // Filter logs to only include those within the challenge date range
    const logsInChallengeRange = allLogs.filter((log: DailyLog) => {
      const logDate = parseISO(log.date);
      return !isBefore(logDate, startDate) && !isAfter(logDate, challengeEndDate) && !isAfter(logDate, today);
    });
    
    console.log("📊 Analytics stats calculation:", {
      startDate: format(startDate, "yyyy-MM-dd"),
      today: format(today, "yyyy-MM-dd"),
      challengeEndDate: format(challengeEndDate, "yyyy-MM-dd"),
      totalLogs: allLogs.length,
      logsInRange: logsInChallengeRange.length,
    });
    
    // Days elapsed since start (including today as in-progress)
    const daysElapsed = Math.min(differenceInDays(today, startDate) + 1, challengeTotalDays);
    
    // Count days with any completed activity (only within challenge range)
    const daysWithActivity = logsInChallengeRange.filter((log: DailyLog) => 
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

    // Calculate streak - only count consecutive days from today backwards
    let currentStreak = 0;
    const sortedLogs = [...logsInChallengeRange].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    console.log("📊 Streak calculation:", {
      today: format(today, "yyyy-MM-dd"),
      sortedLogDates: sortedLogs.map(l => l.date),
    });
    
    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      const logDate = parseISO(log.date);
      const expectedDate = subDays(today, i);
      
      // Make sure expected date is not before challenge start
      if (isBefore(expectedDate, startDate)) {
        break;
      }
      
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

    // Calculate averages (use logs in challenge range only)
    const totalSteps = logsInChallengeRange.reduce((sum: number, log: DailyLog) => sum + (log.stepsCount || 0), 0);
    const totalWater = logsInChallengeRange.reduce((sum: number, log: DailyLog) => sum + (log.waterLiters || 0), 0);
    const totalReading = logsInChallengeRange.reduce((sum: number, log: DailyLog) => sum + (log.readingPages || 0), 0);
    const totalWorkoutTime = logsInChallengeRange.reduce((sum: number, log: DailyLog) => 
      sum + (log.workout1Minutes || 0) + (log.workout2Minutes || 0), 0
    );

    // Completion rates (use logs in challenge range only)
    const workoutCompletions = logsInChallengeRange.filter((log: DailyLog) => 
      (log.workout1Minutes && log.workout1Minutes > 0) || (log.workout2Minutes && log.workout2Minutes > 0)
    ).length;
    const photoCompletions = logsInChallengeRange.filter((log: DailyLog) => log.progressPhotoCompleted).length;

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
      totalPages: totalReading,
      totalWater,
      workoutCompletions,
      photoCompletions,
      waterCompletions: allLogs.filter((log: DailyLog) => log.waterCompleted).length,
      maxSteps: Math.max(...allLogs.map((log: DailyLog) => log.stepsCount || 0), 0),
    };
  }, [allLogs, challenge]);

  // Calculate earned badges based on stats
  const earnedBadges = useMemo(() => {
    if (!stats || !allLogs || allLogs.length === 0) return [];
    
    const badges: BadgeId[] = [];
    
    // Progress badges
    if (stats.completedDays >= 1) badges.push("day_1");
    if (stats.completedDays >= 7) badges.push("week_1");
    if (stats.completedDays >= 25) badges.push("day_25");
    if (stats.completedDays >= 50) badges.push("day_50");
    if (stats.completedDays >= 75) badges.push("day_75");
    if (stats.completedDays >= stats.totalDays) badges.push("challenge_complete");
    
    // Streak badges
    if (stats.currentStreak >= 3) badges.push("streak_3");
    if (stats.currentStreak >= 7) badges.push("streak_7");
    if (stats.currentStreak >= 14) badges.push("streak_14");
    if (stats.currentStreak >= 30) badges.push("streak_30");
    
    // Workout badges
    if (stats.workoutCompletions >= 10) badges.push("workout_10");
    if (stats.workoutCompletions >= 25) badges.push("workout_25");
    if (stats.workoutCompletions >= 50) badges.push("workout_50");
    if (stats.workoutCompletions >= 100) badges.push("workout_100");
    
    // Reading badges
    if (stats.totalPages >= 100) badges.push("pages_100");
    if (stats.totalPages >= 500) badges.push("pages_500");
    if (stats.totalPages >= 1000) badges.push("pages_1000");
    
    // Check if any book was finished
    const finishedBook = allLogs.some((log: DailyLog) => log.finishedBook);
    if (finishedBook) badges.push("book_finished");
    
    // Steps badges
    if (stats.maxSteps >= 10000) badges.push("steps_10k");
    if (stats.maxSteps >= 15000) badges.push("steps_15k");
    if (stats.maxSteps >= 20000) badges.push("steps_20k");
    
    // Water badges
    if (stats.waterCompletions >= 7) badges.push("hydration_7");
    if (stats.waterCompletions >= 30) badges.push("hydration_30");
    
    // Photo badges
    if (stats.photoCompletions >= 7) badges.push("photo_7");
    if (stats.photoCompletions >= 30) badges.push("photo_30");
    
    return badges;
  }, [stats, allLogs]);

  // Get all earned badge IDs (from saved + newly calculated)
  const savedBadgeIds = useMemo(() => 
    savedBadges.map(b => b.badgeId), 
    [savedBadges]
  );

  // Combined badges (saved from DB + newly earned)
  const allEarnedBadges = useMemo(() => {
    const combined = new Set([...savedBadgeIds, ...earnedBadges]);
    return Array.from(combined) as BadgeId[];
  }, [savedBadgeIds, earnedBadges]);

  // Save any newly earned badges to Appwrite
  const { queueBadgeCelebration } = useNotificationStore();
  
  useEffect(() => {
    if (!user?.id || badgesLoading || earnedBadges.length === 0) return;
    
    // Find badges that are earned but not yet saved
    const newBadges = earnedBadges.filter(badgeId => !savedBadgeIds.includes(badgeId));
    
    if (newBadges.length > 0) {
      console.log("🏅 Saving new badges:", newBadges);
      // Save each new badge and trigger celebration
      newBadges.forEach(async (badgeId) => {
        const saved = await createUserBadge(user.id, badgeId, challenge?.$id);
        if (saved) {
          setSavedBadges(prev => [...prev, saved]);
          
          // Trigger badge celebration!
          const badge = BADGES[badgeId];
          if (badge) {
            queueBadgeCelebration(badge);
          }
        }
      });
    }
  }, [user?.id, earnedBadges, savedBadgeIds, badgesLoading, challenge?.$id, queueBadgeCelebration]);

  // Weekly activity data for chart
  const weeklyData = useMemo(() => {
    if (!allLogs || !challenge) return [];

    const today = new Date();
    // Calculate week based on offset
    const targetDate = addDays(today, weekOffset * 7);
    const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const challengeStart = parseISO(challenge.startDate);
    const challengeEnd = addDays(challengeStart, (challenge.totalDays || 75) - 1);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    console.log("📊 Analytics weeklyData:", {
      today: format(today, "yyyy-MM-dd"),
      weekStart: format(weekStart, "yyyy-MM-dd"),
      challengeStart: format(challengeStart, "yyyy-MM-dd"),
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
      
      // Check if this day is part of the challenge window (after start, before end, not future)
      const withinChallengeWindow = !isBefore(day, challengeStart) && !isAfter(day, challengeEnd);
      const isPartOfChallenge = withinChallengeWindow && !isAfter(day, today);
      
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

      console.log(`📊 Day ${dayStr}: hasLog=${hasLog}, hasActivity=${hasCompletedActivity}, isPartOfChallenge=${isPartOfChallenge}`, log ? {
        workout1Completed: log.workout1Completed,
        dietCompleted: log.dietCompleted,
        waterCompleted: log.waterCompleted,
        stepsCount: log.stepsCount,
        workout1Minutes: log.workout1Minutes,
        waterLiters: log.waterLiters,
      } : 'no log');

      // Calculate day number in challenge
      const dayNumber = !isBefore(day, challengeStart) && !isAfter(day, challengeEnd)
        ? differenceInDays(day, challengeStart) + 1
        : null;

      return {
        day: format(day, "EEE"),
        date: format(day, "d"),
        fullDate: day,
        completed: hasCompletedActivity,
        isPartOfChallenge,
        steps: log?.stepsCount || 0,
        dayNumber,
      };
    });
  }, [allLogs, challenge, weekOffset]);

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
              <View className="flex-row items-center justify-between mb-4">
                <Pressable
                  onPress={() => setWeekOffset(weekOffset - 1)}
                  className="h-8 w-8 items-center justify-center rounded-full bg-orange-100"
                >
                  <Feather name="chevron-left" size={18} color="#F97316" />
                </Pressable>
                <Text className="text-sm font-semibold text-gray-600">
                  {weekOffset === 0 ? "This Week" : weekOffset === -1 ? "Last Week" : weekOffset === 1 ? "Next Week" : `${Math.abs(weekOffset)} Weeks ${weekOffset < 0 ? 'Ago' : 'Ahead'}`}
                </Text>
                <Pressable
                  onPress={() => setWeekOffset(weekOffset + 1)}
                  disabled={weekOffset >= 0}
                  className={`h-8 w-8 items-center justify-center rounded-full ${
                    weekOffset >= 0 ? 'bg-gray-50' : 'bg-orange-100'
                  }`}
                >
                  <Feather name="chevron-right" size={18} color={weekOffset >= 0 ? "#D1D5DB" : "#F97316"} />
                </Pressable>
              </View>
              <View className="flex-row justify-between">
                {weeklyData.map((day, index) => {
                  const isClickable = day.isPartOfChallenge;
                  const showActivity = day.isPartOfChallenge && day.completed;
                  
                  const handleDayPress = () => {
                    if (isClickable) {
                      // Open the day detail modal
                      setSelectedDate(day.fullDate);
                      setShowDayModal(true);
                    }
                  };
                  
                  return (
                    <Pressable 
                      key={index} 
                      className="items-center flex-1"
                      onPress={handleDayPress}
                      disabled={!isClickable}
                    >
                      <Text className="text-xs text-gray-400 mb-1">{day.day}</Text>
                      {day.dayNumber && (
                        <Text className="text-[10px] text-gray-400 mb-1">Day {day.dayNumber}</Text>
                      )}
                      <View 
                        className={`h-10 w-10 rounded-full items-center justify-center ${
                          showActivity ? "bg-purple-500" : 
                          day.isPartOfChallenge ? "bg-gray-100" : "bg-transparent"
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${
                          showActivity ? "text-white" : 
                          day.isPartOfChallenge ? "text-gray-600" : "text-gray-300"
                        }`}>
                          {day.date}
                        </Text>
                      </View>
                      {showActivity && (
                        <Feather name="check" size={12} color="#10B981" style={{ marginTop: 4 }} />
                      )}
                      {day.isPartOfChallenge && !day.completed && (
                        <View style={{ height: 16 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Averages - only show for tracked activities */}
            {(challenge?.trackSteps || challenge?.trackWater || challenge?.trackReading || challenge?.trackWorkout1 || challenge?.trackWorkout2) && (
              <>
                <Text className="text-sm font-semibold text-gray-500 mb-3 ml-1">Daily Averages</Text>
                <View className="flex-row flex-wrap gap-3 mb-4">
                  {challenge?.trackSteps && (
                    <View className="flex-1 min-w-[45%]">
                      <StatCard
                        icon="activity"
                        label="Avg Steps"
                        value={stats.avgSteps.toLocaleString()}
                        color="#10B981"
                        bgColor="#D1FAE5"
                      />
                    </View>
                  )}
                  {challenge?.trackWater && (
                    <View className="flex-1 min-w-[45%]">
                      <StatCard
                        icon="droplet"
                        label="Avg Water"
                        value={stats.avgWater}
                        unit="L"
                        color="#3B82F6"
                        bgColor="#DBEAFE"
                      />
                    </View>
                  )}
                  {challenge?.trackReading && (
                    <View className="flex-1 min-w-[45%]">
                      <StatCard
                        icon="book-open"
                        label="Avg Reading"
                        value={stats.avgReading}
                        unit="pages"
                        color="#8B5CF6"
                        bgColor="#EDE9FE"
                      />
                    </View>
                  )}
                  {(challenge?.trackWorkout1 || challenge?.trackWorkout2) && (
                    <View className="flex-1 min-w-[45%]">
                      <StatCard
                        icon="clock"
                        label="Total Workout"
                        value={stats.totalWorkoutTime}
                        unit="min"
                        color="#F59E0B"
                        bgColor="#FEF3C7"
                      />
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Milestones & Badges */}
            <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-semibold text-gray-600">Milestones</Text>
                <Text className="text-xs text-gray-400">{allEarnedBadges.length} earned</Text>
              </View>
              {allEarnedBadges.length > 0 ? (
                <View className="flex-row flex-wrap gap-3">
                  {allEarnedBadges.slice(0, 8).map((badgeId) => {
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
              {allEarnedBadges.length > 8 && (
                <Text className="text-xs text-purple-500 text-center mt-3">
                  +{allEarnedBadges.length - 8} more badges earned
                </Text>
              )}
            </View>
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
            {/* Re-sync from Apple Health button (iOS only, if workouts are tracked) */}
            {Platform.OS === "ios" && (challenge?.trackWorkout1 || challenge?.trackWorkout2) && selectedDayLog && (
              <Pressable
                onPress={handleResyncHealthData}
                disabled={resyncing}
                className={`flex-row items-center justify-center bg-purple-50 rounded-2xl p-3 mb-4 ${
                  resyncing ? 'opacity-50' : ''
                }`}
              >
                <Feather name={resyncing ? "loader" : "refresh-cw"} size={16} color="#8B5CF6" />
                <Text className="text-sm font-semibold text-purple-600 ml-2">
                  {resyncing ? "Re-syncing..." : "Re-sync Workouts from Apple Health"}
                </Text>
              </Pressable>
            )}

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

            {/* Workout Details Card - Show if any workout logged */}
            {selectedDayLog && ((selectedDayLog.workout1Minutes ?? 0) > 0 || (selectedDayLog.workout2Minutes ?? 0) > 0) && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-3">Workout Details</Text>
                {(() => {
                  const details = selectedDayLog.workoutDetails ? (() => {
                    try {
                      return JSON.parse(selectedDayLog.workoutDetails);
                    } catch {
                      return {};
                    }
                  })() : {};
                  
                  const hasWorkout1 = (selectedDayLog.workout1Minutes ?? 0) > 0;
                  const hasWorkout2 = (selectedDayLog.workout2Minutes ?? 0) > 0;
                  
                  return (
                    <View>
                      {hasWorkout1 && (
                        <View className={hasWorkout2 ? "mb-4" : ""}>
                          <View className="flex-row items-center mb-2">
                            <View className="h-8 w-8 rounded-full bg-orange-100 items-center justify-center mr-2">
                              <Feather name="activity" size={16} color="#F97316" />
                            </View>
                            <View>
                              <Text className="text-sm font-semibold text-gray-900">Workout 1</Text>
                              <Text className="text-xs text-gray-500">{selectedDayLog.workout1Minutes} minutes</Text>
                            </View>
                          </View>
                          {details.workout1?.type && (
                            <Text className="text-sm text-gray-700 mb-1">
                              Type: <Text className="font-medium">{details.workout1.type.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                            </Text>
                          )}
                          {details.workout1?.syncedFromHealth && (
                            <View className="flex-row items-center mb-1">
                              <Feather name="heart" size={12} color="#8B5CF6" />
                              <Text className="text-xs text-purple-600 ml-1">Synced from Apple Health</Text>
                            </View>
                          )}
                          {details.workout1?.notes && (
                            <Text className="text-sm text-gray-600 mt-1">{details.workout1.notes}</Text>
                          )}
                        </View>
                      )}
                      {hasWorkout2 && (
                        <View className={hasWorkout1 ? "pt-4 border-t border-gray-100" : ""}>
                          <View className="flex-row items-center mb-2">
                            <View className="h-8 w-8 rounded-full bg-purple-100 items-center justify-center mr-2">
                              <Feather name="activity" size={16} color="#8B5CF6" />
                            </View>
                            <View>
                              <Text className="text-sm font-semibold text-gray-900">Workout 2</Text>
                              <Text className="text-xs text-gray-500">{selectedDayLog.workout2Minutes} minutes</Text>
                            </View>
                          </View>
                          {details.workout2?.type && (
                            <Text className="text-sm text-gray-700 mb-1">
                              Type: <Text className="font-medium">{details.workout2.type.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</Text>
                            </Text>
                          )}
                          {details.workout2?.syncedFromHealth && (
                            <View className="flex-row items-center mb-1">
                              <Feather name="heart" size={12} color="#8B5CF6" />
                              <Text className="text-xs text-purple-600 ml-1">Synced from Apple Health</Text>
                            </View>
                          )}
                          {details.workout2?.notes && (
                            <Text className="text-sm text-gray-600 mt-1">{details.workout2.notes}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {selectedDayLog?.moodNotes && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">Mood Notes</Text>
                {(() => {
                  const moodData = parseMoodNotes(selectedDayLog.moodNotes);
                  if (!moodData) return null;
                  
                  return (
                    <View>
                      {/* Show emotions if structured data */}
                      {moodData.isStructured && moodData.emotions.length > 0 && (
                        <View className="mb-3">
                          <Text className="text-xs font-medium text-gray-500 mb-2">Emotions</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {moodData.emotions.map((emotion: string, index: number) => (
                              <View key={index} className="bg-purple-100 rounded-full px-3 py-1">
                                <Text className="text-sm text-purple-700">{emotion}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      {/* Show notes if available */}
                      {moodData.notes && (
                        <Text className="text-gray-700">{moodData.notes}</Text>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}

            {/* Diet Notes - separated by meal */}
            {selectedDayLog?.meals && (
              <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">Diet Notes</Text>
                {(() => {
                  const mealData = parseMealData(selectedDayLog.meals);
                  if (!mealData || mealData.length === 0) return null;
                  
                  return (
                    <View>
                      {mealData.map((meal, index) => (
                        <View key={meal.key} className={`${index < mealData.length - 1 ? 'mb-4' : ''}`}>
                          <View className="flex-row items-center mb-2">
                            <View 
                              className="h-6 w-6 items-center justify-center rounded-full mr-2"
                              style={{ backgroundColor: `${meal.color}20` }}
                            >
                              <Feather name={meal.icon} size={14} color={meal.color} />
                            </View>
                            <Text className="text-sm font-medium" style={{ color: meal.color }}>
                              {meal.label}
                            </Text>
                          </View>
                          <Text className="text-gray-700 ml-8">{meal.content}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}
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

      {/* Resync Progress Modal */}
      <Modal visible={showResyncModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl">
            <Text className="text-xl font-bold text-gray-900 mb-4">Resync Progress</Text>
            
            <ScrollView className="max-h-96 mb-4">
              {resyncLogs.map((log, index) => (
                <Text key={index} className="text-sm text-gray-700 mb-2 font-mono">
                  {log}
                </Text>
              ))}
            </ScrollView>
            
            {!resyncing && (
              <Pressable
                onPress={() => setShowResyncModal(false)}
                className="bg-orange-500 rounded-xl py-3 px-6 items-center active:opacity-80"
              >
                <Text className="text-white font-semibold">Close</Text>
              </Pressable>
            )}
            
            {resyncing && (
              <View className="py-3 items-center">
                <Text className="text-gray-500">Processing...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
