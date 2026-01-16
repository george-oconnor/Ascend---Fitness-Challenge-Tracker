import { NotificationBell, NotificationTray } from "@/components/NotificationTray";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Header({ 
  name = "NO USER",
  title,
  subtitle = "Welcome back",
  noPaddingBottom = false
}: { 
  name?: string;
  title?: string;
  subtitle?: string;
  noPaddingBottom?: boolean;
}) {
  const { user } = useSessionStore();
  const { challenge } = useChallengeStore();
  const [showNotifications, setShowNotifications] = useState(false);
  
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";
  
  const displayTitle = title ?? name;
  
  // Calculate current streak/day
  const getCurrentDay = () => {
    if (!challenge) return null;
    const startDate = new Date(challenge.startDate);
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysPassed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysPassed < 1) return null;
    return Math.min(daysPassed, challenge.totalDays);
  };
  
  const currentDay = getCurrentDay();

  return (
    <>
      <View className={`flex-row items-center justify-between px-4 pt-4 ${noPaddingBottom ? "" : "pb-6"}`}>
        <View className="flex-1">
          <Text className="text-xs text-gray-500">{subtitle}</Text>
          <Text className="text-2xl font-bold text-dark-100">{displayTitle}</Text>
        </View>
        
        {/* Streak badge */}
        {currentDay && (
          <Pressable 
            onPress={() => router.push("/daily-log")}
            className="flex-row items-center bg-amber-50 px-3 py-1.5 rounded-full mr-3"
            style={{ borderWidth: 1, borderColor: '#FDE68A' }}
          >
            <Feather name="zap" size={14} color="#F59E0B" />
            <Text className="text-sm font-bold text-amber-600 ml-1">Day {currentDay}</Text>
          </Pressable>
        )}
        
        <View className="flex-row items-center gap-3">
          <NotificationBell onPress={() => setShowNotifications(true)} />
          <Pressable onPress={() => router.push("/profile")}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Text className="text-xs font-bold text-white">{initials}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Notification Dropdown */}
      <NotificationTray 
        visible={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </>
  );
}
