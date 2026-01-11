import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { user, logout } = useSessionStore();
  const { challenge } = useChallengeStore();
  const [loading, setLoading] = useState(false);
  
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      router.replace("/auth");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const MenuItem = ({ 
    icon, 
    label, 
    onPress,
    showChevron = true,
    danger = false
  }: { 
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress?: () => void;
    showChevron?: boolean;
    danger?: boolean;
  }) => (
    <Pressable 
      onPress={onPress}
      className="flex-row items-center bg-white px-4 py-3.5 border-b border-gray-100"
    >
      <View className={`h-8 w-8 items-center justify-center rounded-full mr-3 ${danger ? "bg-red-100" : "bg-gray-100"}`}>
        <Feather name={icon} size={18} color={danger ? "#EF4444" : "#6B7280"} />
      </View>
      <Text className={`flex-1 text-base ${danger ? "text-red-500" : "text-gray-900"}`}>{label}</Text>
      {showChevron && <Feather name="chevron-right" size={20} color="#9CA3AF" />}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
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

        {/* Challenge Section */}
        <View className="mt-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">Challenge</Text>
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <MenuItem 
              icon="settings" 
              label="Challenge Settings" 
              onPress={() => router.push("/challenge-setup")}
            />
            <MenuItem 
              icon="calendar" 
              label="Daily Log" 
              onPress={() => router.push("/daily-log")}
            />
          </View>
        </View>

        {/* Account Section */}
        <View className="mt-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">Account</Text>
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <MenuItem 
              icon="user" 
              label="Edit Profile" 
              onPress={() => {}}
            />
            <MenuItem 
              icon="lock" 
              label="Change Password" 
              onPress={() => {}}
            />
            <MenuItem 
              icon="bell" 
              label="Notifications" 
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Support Section */}
        <View className="mt-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">Support</Text>
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <MenuItem 
              icon="help-circle" 
              label="Help & FAQ" 
              onPress={() => {}}
            />
            <MenuItem 
              icon="message-circle" 
              label="Contact Us" 
              onPress={() => {}}
            />
            <MenuItem 
              icon="shield" 
              label="Privacy Policy" 
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Logout */}
        <View className="mt-6 mb-8">
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <Pressable 
              onPress={handleLogout}
              disabled={loading}
              className="flex-row items-center px-4 py-3.5"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-red-100 mr-3">
                {loading ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Feather name="log-out" size={18} color="#EF4444" />
                )}
              </View>
              <Text className="flex-1 text-base text-red-500">Log Out</Text>
            </Pressable>
          </View>
        </View>

        {/* Account Info */}
        <View className="mb-8 items-center">
          <Text className="text-xs text-gray-400">
            Account ID: {user?.id ? user.id.slice(0, 8) + "..." : "N/A"}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
