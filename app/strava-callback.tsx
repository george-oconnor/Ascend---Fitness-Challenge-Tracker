import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Fallback screen for the Strava OAuth redirect. In the normal flow,
// ASWebAuthenticationSession (via expo-web-browser) intercepts this URL
// before it ever reaches app routing, so connectStrava() in lib/strava.ts
// already has the result by the time this would render. This exists only
// so an unexpected deep-link hit doesn't dead-end the user.
export default function StravaCallbackScreen() {
  useEffect(() => {
    router.replace("/settings");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-orange-50 items-center justify-center">
      <ActivityIndicator size="small" color="#F97316" />
      <Text className="text-gray-500 mt-3">Finishing up...</Text>
    </SafeAreaView>
  );
}
