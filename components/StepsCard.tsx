import { useHealthStore } from "@/store/useHealthStore";
import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

export default function StepsCard() {
  const { steps, isLoading, isAuthorized, isAvailable, isNativeModuleAvailable, error, initialize, fetchTodayData } = useHealthStore();
  const [connecting, setConnecting] = useState(false);
  const [checkAttempted, setCheckAttempted] = useState(false);

  useEffect(() => {
    // On mount, attempt to initialize which will trigger the module availability check
    if (Platform.OS === "ios" && !checkAttempted) {
      setCheckAttempted(true);
      // This will set isNativeModuleAvailable in the store
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

  // Hide on non-iOS
  if (Platform.OS !== "ios") {
    return null;
  }

  // Show loading state while we check module availability
  if (!checkAttempted || (isLoading && !isNativeModuleAvailable && !error)) {
    return (
      <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-3 text-gray-500">Checking Apple Health...</Text>
        </View>
      </View>
    );
  }

  // Show message if native module isn't available (Expo Go or module not linked)
  if (!isNativeModuleAvailable) {
    return (
      <View className="bg-yellow-50 rounded-2xl p-6 mb-4 border border-yellow-200">
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <Feather name="alert-circle" size={24} color="#CA8A04" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-yellow-800">Apple Health</Text>
            <Text className="text-sm text-yellow-700 mt-1">
              {error || "Requires TestFlight or development build"}
            </Text>
          </View>
        </View>
      </View>
    );
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
        {error && (
          <Text className="text-sm text-red-500 mb-2">{error}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={connecting}
          onPress={async () => {
            try {
              setConnecting(true);
              const ok = await initialize();
              if (ok) {
                await fetchTodayData();
              }
            } finally {
              setConnecting(false);
            }
          }}
          className="mt-3 self-start bg-blue-600 rounded-xl px-4 py-2"
        >
          {connecting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold">Connect Apple Health</Text>
          )}
        </Pressable>
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
