import { createActivityLog, getActivityLogsForDate, updateActivityLog, updateDailyLog } from "@/lib/appwrite";
import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

// Circular progress for reading
function ReadingProgress({ current, goal }: { current: number; goal: number }) {
  const percent = Math.min(100, Math.round((current / goal) * 100));
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#A855F7"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center">
        <Feather name="book-open" size={32} color="#A855F7" />
        <Text className="text-2xl font-bold text-gray-800 mt-1">{current}</Text>
        <Text className="text-sm text-gray-500">of {goal} pages</Text>
      </View>
    </View>
  );
}

export default function LogReadingScreen() {
  const { date: dateParam, logId: logIdParam } = useLocalSearchParams<{ date?: string; logId?: string }>();
  const { challenge, todayLog, updateProgress, allLogs, fetchAllLogs } = useChallengeStore();
  
  const isEditingPastDay = !!dateParam && !!logIdParam;
  const targetLog = isEditingPastDay 
    ? allLogs?.find(log => log.$id === logIdParam) 
    : todayLog;
  const targetDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [pages, setPages] = useState(targetLog?.readingPages ?? 0);
  const [inputValue, setInputValue] = useState((targetLog?.readingPages ?? 0).toString());
  const [finishedBook, setFinishedBook] = useState(targetLog?.finishedBook ?? false);
  const [saving, setSaving] = useState(false);

  if (!challenge || !targetLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const goal = challenge.readingPages ?? 10;
  const isComplete = pages >= goal;

  const handleInputChange = (text: string) => {
    setInputValue(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0) {
      setPages(num);
    } else if (text === "") {
      setPages(0);
    }
  };

  const handleQuickAdd = (amount: number) => {
    const newPages = Math.max(0, pages + amount);
    setPages(newPages);
    setInputValue(newPages.toString());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditingPastDay && logIdParam) {
        await updateDailyLog(logIdParam, {
          readingPages: pages,
          readingCompleted: pages >= goal || finishedBook,
          finishedBook: finishedBook,
        });
        
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        const existingLogs = await getActivityLogsForDate(challenge.$id!, dateStr, 'reading');
        const activityData = {
          userId: challenge.userId,
          challengeId: challenge.$id!,
          type: 'reading' as const,
          title: "Reading Logged",
          description: pages + " pages" + (finishedBook ? " - Book finished! 📚" : ""),
          value: pages,
          unit: "pages",
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
          readingPages: pages,
          readingCompleted: pages >= goal || finishedBook,
          finishedBook: finishedBook,
        });

        const { logActivity } = useChallengeStore.getState();
        await logActivity({
          type: "reading",
          title: "Reading Logged",
          description: pages + " pages" + (finishedBook ? " - Book finished! 📚" : ""),
          value: pages,
          unit: "pages",
        });
      }
      router.back();
    } catch (err) {
      console.error("Failed to save reading:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Log Reading</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
        {/* Progress Circle */}
        <View className="items-center mb-6">
          <ReadingProgress current={pages} goal={goal} />
          {(isComplete || finishedBook) && (
            <View className="mt-4 flex-row items-center gap-2">
              {isComplete && (
                <View className="bg-purple-100 px-4 py-2 rounded-full flex-row items-center">
                  <Feather name="check-circle" size={16} color="#7E22CE" />
                  <Text className="text-purple-700 font-semibold ml-2">Goal reached!</Text>
                </View>
              )}
              {finishedBook && (
                <View className="bg-purple-100 px-4 py-2 rounded-full flex-row items-center">
                  <Feather name="book" size={16} color="#7E22CE" />
                  <Text className="text-purple-700 font-semibold ml-2">Book finished!</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Page Input */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Pages Read Today</Text>
          <View className="flex-row items-center justify-center">
            <Pressable
              onPress={() => handleQuickAdd(-1)}
              className="bg-gray-100 h-12 w-12 rounded-full items-center justify-center"
            >
              <Feather name="minus" size={20} color="#6B7280" />
            </Pressable>
            <TextInput
              value={inputValue}
              onChangeText={handleInputChange}
              keyboardType="number-pad"
              className="text-4xl font-bold text-gray-800 mx-6 w-24 text-center"
              maxLength={4}
            />
            <Pressable
              onPress={() => handleQuickAdd(1)}
              className="bg-purple-100 h-12 w-12 rounded-full items-center justify-center"
            >
              <Feather name="plus" size={20} color="#A855F7" />
            </Pressable>
          </View>
        </View>

        {/* Quick Add Buttons */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-3">Quick Add</Text>
          <View className="flex-row justify-around">
            <Pressable
              onPress={() => handleQuickAdd(10)}
              className="bg-purple-50 px-4 py-3 rounded-xl items-center"
            >
              <Feather name="file-text" size={20} color="#9333EA" />
              <Text className="text-sm font-medium text-purple-700 mt-1">+10 pages</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAdd(20)}
              className="bg-purple-50 px-4 py-3 rounded-xl items-center"
            >
              <Feather name="file-text" size={20} color="#9333EA" />
              <Text className="text-sm font-medium text-purple-700 mt-1">+20 pages</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAdd(50)}
              className="bg-purple-50 px-4 py-3 rounded-xl items-center"
            >
              <Feather name="book-open" size={20} color="#9333EA" />
              <Text className="text-sm font-medium text-purple-700 mt-1">+50 pages</Text>
            </Pressable>
          </View>
        </View>

        {/* Finished a Book Checkbox */}
        <Pressable
          onPress={() => setFinishedBook(!finishedBook)}
          className={
            "flex-row items-center justify-between p-4 rounded-2xl mb-6 shadow-sm " +
            (finishedBook ? "bg-purple-100" : "bg-white")
          }
        >
          <View className="flex-row items-center flex-1">
            <View 
              className={
                "h-12 w-12 rounded-full items-center justify-center " +
                (finishedBook ? "bg-purple-500" : "bg-gray-100")
              }
            >
              <Feather 
                name={finishedBook ? "check" : "book"} 
                size={24} 
                color={finishedBook ? "white" : "#6B7280"} 
              />
            </View>
            <View className="ml-3 flex-1">
              <Text 
                className={
                  "text-base font-semibold " +
                  (finishedBook ? "text-purple-800" : "text-gray-800")
                }
              >
                Finished a book today
              </Text>
              <Text 
                className={
                  "text-xs " +
                  (finishedBook ? "text-purple-600" : "text-gray-500")
                }
              >
                {finishedBook 
                  ? "Amazing! Keep up the reading!" 
                  : "Tap to mark as complete"}
              </Text>
            </View>
          </View>
          <View 
            className={
              "h-8 w-8 rounded-full items-center justify-center " +
              (finishedBook ? "bg-purple-500" : "bg-gray-200")
            }
          >
            {finishedBook && <Feather name="check" size={16} color="white" />}
          </View>
        </Pressable>

        {/* Reading Motivation */}
        <View className="bg-purple-50 rounded-2xl p-4">
          <View className="flex-row items-center mb-2">
            <Feather name="book-open" size={16} color="#6B21A8" />
            <Text className="text-sm font-semibold text-purple-800 ml-2">Reading Tip</Text>
          </View>
          <Text className="text-sm text-purple-700">
            {pages === 0 && !finishedBook
              ? "Even 10 pages a day adds up to 3,650 pages a year!"
              : finishedBook
                ? "Congratulations on finishing a book!"
                : pages < goal
                  ? "Just " + (goal - pages) + " more pages to hit your goal!"
                  : "Bookworm status achieved! Keep it up!"}
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="px-4 pb-6">
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={
            "py-4 rounded-2xl items-center " +
            (saving ? "bg-gray-300" : "bg-purple-500")
          }
        >
          <Text className="text-white font-bold text-lg">
            {saving ? "Saving..." : "Save Reading Progress"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
