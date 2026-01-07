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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-white -mx-5 px-5 pt-2 pb-6 mb-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center gap-2"
            >
              <Feather name="chevron-left" size={20} color="#7C3AED" />
              <Text className="text-primary text-base font-semibold">Back</Text>
            </Pressable>
            <Text className="text-xs text-gray-500">Account</Text>
          </View>
          <View className="mt-1 items-end">
            <Text className="text-2xl font-bold text-dark-100">Profile</Text>
          </View>
        </View>

        {/* Avatar Section */}
        <View className="mb-8 items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-primary">
            <Text className="text-4xl font-bold text-white">
              {initials}
            </Text>
          </View>
        </View>

        {/* User Info */}
        <View className="mb-8 rounded-2xl bg-gray-50 p-4">
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-500 mb-1">Name</Text>
            <Text className="text-base font-semibold text-dark-100">
              {user?.name || "Unknown"}
            </Text>
          </View>
          <View>
            <Text className="text-xs font-semibold text-gray-500 mb-1">Email</Text>
            <Text className="text-base font-semibold text-dark-100">
              {user?.email || "No email"}
            </Text>
          </View>
        </View>

        {/* Settings Section */}
        <View className="mb-8">
          <Text className="text-sm font-semibold text-gray-500 mb-3">Settings</Text>
          <Pressable className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-2">
            <Text className="text-base text-dark-100">Change Password</Text>
          </Pressable>
          <Pressable className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <Text className="text-base text-dark-100">Notification Settings</Text>
          </Pressable>
        </View>

        {/* Logout Button */}
        <View className="mt-auto mb-4">
          <Pressable
            onPress={handleLogout}
            disabled={loading}
            className={`rounded-2xl py-4 items-center ${
              loading ? "bg-gray-300" : "bg-red-500"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">Logout</Text>
            )}
          </Pressable>
        </View>

        {/* Account Info */}
        <View className="mb-4 items-center">
          <Text className="text-xs text-gray-400">
            Account ID: {user?.id ? user.id.slice(0, 8) + "..." : "N/A"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
