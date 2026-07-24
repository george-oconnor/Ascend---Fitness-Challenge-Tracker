import { isAppleAuthAvailable } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { loginWithApple, status, error } = useSessionStore();
  const [appleAvailable, setAppleAvailable] = useState(true);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const handleApple = async () => {
    try {
      await loginWithApple();
      // Navigation is handled by the root layout once status becomes
      // "authenticated" or "icloud-unavailable".
    } catch {
      // Error is surfaced by the store
    }
  };

  const loading = status === "loading";

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <View className="items-center mb-12">
          <Text className="text-4xl font-bold text-dark-100 mb-3">Ascend</Text>
          <Text className="text-base text-gray-500 text-center">
            Track workouts, water, sleep, and more — synced automatically, with streaks and badges to keep you going.
          </Text>
        </View>

        {error ? (
          <View className="px-4 py-3 rounded-2xl bg-red-50 mb-4">
            <Text className="text-sm text-red-600">{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View className="py-4 items-center">
            <ActivityIndicator />
          </View>
        ) : appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={16}
            style={{ height: 52, width: "100%" }}
            onPress={handleApple}
          />
        ) : (
          <View className="px-4 py-3 rounded-2xl bg-gray-100">
            <Text className="text-sm text-gray-600 text-center">
              Sign in with Apple isn&apos;t available on this device.
            </Text>
          </View>
        )}

        <Pressable className="mt-8 items-center" onPress={() => router.push("/migrate")} disabled={loading}>
          <Text className="text-primary font-semibold">Migrating from an old account?</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
