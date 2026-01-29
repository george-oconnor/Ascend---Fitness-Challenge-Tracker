import { useNotificationStore } from "@/store/useNotificationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useSessionStore();
  const { notificationsEnabled, setNotificationsEnabled } = useNotificationStore();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data including challenges, logs, and progress.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              router.replace("/auth");
            } catch (err) {
              const message = err instanceof Error ? err.message : "Failed to delete account";
              Alert.alert("Error", message);
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = async (value: boolean) => {
    await setNotificationsEnabled(value);
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
    <SafeAreaView className="flex-1 bg-orange-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-orange-100 flex-row items-center">
        <Pressable 
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-orange-100 mr-3"
        >
          <Feather name="arrow-left" size={20} color="#F97316" />
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
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
              onPress={() => router.push("/edit-profile")}
            />
            <Pressable className="flex-row items-center bg-white px-4 py-3.5 border-b border-gray-100">
              <View className="h-8 w-8 items-center justify-center rounded-full mr-3 bg-gray-100">
                <Feather name="bell" size={18} color="#6B7280" />
              </View>
              <Text className="flex-1 text-base text-gray-900">Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: "#D1D5DB", true: "#A78BFA" }}
                thumbColor={notificationsEnabled ? "#8B5CF6" : "#F3F4F6"}
              />
            </Pressable>
          </View>
        </View>

        {/* Support Section */}
        <View className="mt-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">Support</Text>
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <MenuItem 
              icon="message-circle" 
              label="Contact Us" 
              onPress={() => Linking.openURL('mailto:george@georgeoc.com')}
            />
            <MenuItem 
              icon="shield" 
              label="Privacy Policy" 
              onPress={() => Linking.openURL('https://george-oconnor.github.io/Ascend---Fitness-Challenge-Tracker/privacy')}
            />
          </View>
        </View>

        {/* Logout */}
        <View className="mt-6 mb-8">
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <Pressable 
              onPress={handleLogout}
              disabled={loading}
              className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
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
            
            <Pressable 
              onPress={handleDeleteAccount}
              disabled={deleting}
              className="flex-row items-center px-4 py-3.5"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-red-100 mr-3">
                {deleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Feather name="trash-2" size={18} color="#EF4444" />
                )}
              </View>
              <Text className="flex-1 text-base text-red-500">Delete My Account</Text>
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
