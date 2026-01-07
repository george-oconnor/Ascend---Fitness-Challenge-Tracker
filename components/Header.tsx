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
          <Pressable 
            onPress={() => setShowNotifications(!showNotifications)}
            className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm relative"
          >
            <Feather name="bell" size={18} color="#181C2E" />
          </Pressable>
          <Pressable onPress={() => router.push("/profile")}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Text className="text-xs font-bold text-white">{initials}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Notification Dropdown */}
      {showNotifications && (
        <Pressable 
          onPress={() => setShowNotifications(false)}
          className="absolute top-14 right-0 left-0 bottom-0 z-50"
        >
          <View className="absolute top-2 right-4 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <View className="px-4 py-3 border-b border-gray-100">
                <Text className="text-base font-semibold text-dark-100">Notifications</Text>
              </View>

              {/* Empty State */}
              <View className="px-4 py-8">
                <View className="items-center">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-50 mb-2">
                    <Feather name="check-circle" size={24} color="#9CA3AF" />
                  </View>
                  <Text className="text-sm text-gray-500">All caught up!</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      )}
    </>
  );
}
