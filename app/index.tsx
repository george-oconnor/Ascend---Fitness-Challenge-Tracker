import { Header } from "@/components/Header";
import { useSessionStore } from "@/store/useSessionStore";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { user, logout } = useSessionStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Header />
      
      <ScrollView className="flex-1">
        <View className="p-4">
          {/* Welcome Card */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Your App! 👋
            </Text>
            <Text className="text-gray-600 mb-4">
              Logged in as: {user?.email}
            </Text>
            <Text className="text-gray-500 text-sm">
              This is a starter template with Appwrite authentication. Start building your features here!
            </Text>
          </View>

          {/* Quick Actions */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              Quick Start
            </Text>
            
            <View className="space-y-3">
              <View className="flex-row items-center p-3 bg-purple-50 rounded-lg">
                <Text className="text-3xl mr-3">📱</Text>
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">Add Your Screens</Text>
                  <Text className="text-sm text-gray-600">Create new screens in app/ folder</Text>
                </View>
              </View>

              <View className="flex-row items-center p-3 bg-blue-50 rounded-lg">
                <Text className="text-3xl mr-3">🎨</Text>
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">Customize UI</Text>
                  <Text className="text-sm text-gray-600">Update components/ folder</Text>
                </View>
              </View>

              <View className="flex-row items-center p-3 bg-green-50 rounded-lg">
                <Text className="text-3xl mr-3">⚡</Text>
                <View className="flex-1">
                  <Text className="font-medium text-gray-900">Add Features</Text>
                  <Text className="text-sm text-gray-600">Build on top of Appwrite backend</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <Pressable
            onPress={handleLogout}
            className="bg-red-500 rounded-xl py-4 items-center active:bg-red-600"
          >
            <Text className="text-white font-semibold text-lg">Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
