import { NotificationBell, NotificationTray } from "@/components/NotificationTray";
import { useSessionStore } from "@/store/useSessionStore";
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
  const [showNotifications, setShowNotifications] = useState(false);
  
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";
  
  const displayTitle = title ?? name;

  return (
    <>
      <View className={`flex-row items-center justify-between px-4 pt-4 ${noPaddingBottom ? "" : "pb-6"}`}>
        <View>
          <Text className="text-xs text-gray-500">{subtitle}</Text>
          <Text className="text-2xl font-bold text-dark-100">{displayTitle}</Text>
        </View>
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
