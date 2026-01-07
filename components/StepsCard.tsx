import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

export default function StepsCard() {
  const { steps, isLoading, isAuthorized, isAvailable, initialize, fetchTodayData } = useHealthStore();

  useEffect(() => {
    if (Platform.OS === "ios") {
      initialize();
    }
  }, []);

  useEffect(() => {
    if (isAuthorized && Platform.OS === "ios") {
      fetchTodayData();
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        fetchTodayData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  if (Platform.OS !== "ios" || !isAvailable) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <View className="flex-row items-center mb-2">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Feather name="activity" size={24} color="#3B82F6" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-gray-900">Steps Today</Text>
            <Text className="text-sm text-gray-500 mt-1">Connect Apple Health to track steps</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Feather name="activity" size={24} color="#3B82F6" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-sm text-gray-500">Steps Today</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Text className="text-3xl font-bold text-gray-900 mt-1">
                {steps.toLocaleString()}
              </Text>
            )}
          </View>
        </View>
        <View className="items-end">
          <View className="bg-blue-50 px-3 py-1.5 rounded-full">
            <Text className="text-xs font-semibold text-blue-600">LIVE</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
