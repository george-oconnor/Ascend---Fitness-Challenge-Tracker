import { BadgeCelebration } from "@/components/BadgeCelebration";
import { ICloudGate } from "@/components/ICloudGate";
import { setNotificationsEnabledCheck } from "@/lib/notifications";
import { getHasSeenOnboarding } from "@/lib/onboarding";
import { initSentry, logger } from "@/lib/sentry";
import { useHealthStore } from "@/store/useHealthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import './globals.css';

// Initialize Sentry before app renders
initSentry();

// App startup events disabled to reduce Sentry noise
// if (!__DEV__) {
//   captureMessage("App started successfully", "info");
//   // Also test logger.info to ensure it works
//   logger.info("Logger test on startup", { 
//     platform: Platform.OS,
//     buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE,
//     timestamp: new Date().toISOString()
//   });
// }

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "QuickSand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
    "QuickSand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
    "QuickSand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
    "QuickSand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
    "QuickSand-Light": require("../assets/fonts/Quicksand-Light.ttf"),
  });

  const { checkSession, status } = useSessionStore();
  const { initialize: initNotifications, celebratingBadge, dismissBadgeCelebration, notificationsEnabled } = useNotificationStore();
  const { initialize: initHealth, isNativeModuleAvailable, isAuthorized, error: healthError } = useHealthStore();
  const router = useRouter();
  const segments = useSegments();
  const navigationAttempted = useRef(false);
  const healthInitAttempted = useRef(false);
  const [hasSeenOnboarding, setHasSeenOnboardingState] = useState<boolean | null>(null);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  // Initialize notifications
  useEffect(() => {
    initNotifications();
    
    // Set up the notifications enabled check for the notification service
    setNotificationsEnabledCheck(() => notificationsEnabled);

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("📬 Notification received:", notification.request.content.title);
    });

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("📬 Notification tapped:", data);
      
      // Navigate based on notification type
      if (data?.type === "badge_earned") {
        router.push("/(tabs)/analytics");
      } else if (data?.type === "reminder" || data?.type === "task_complete") {
        router.push("/(tabs)");
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [notificationsEnabled]);

  // Initialize HealthKit early on iOS
  useEffect(() => {
    if (Platform.OS === "ios" && !healthInitAttempted.current) {
      healthInitAttempted.current = true;
      logger.info("Starting HealthKit initialization from _layout");
      
      initHealth().then((authorized) => {
        logger.info("HealthKit initialization complete", {
          authorized,
          isNativeModuleAvailable,
          healthError,
        });
      }).catch((err) => {
        logger.error("HealthKit initialization error in _layout", {
          error: err?.message || String(err),
        });
      });
    }
  }, []);

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkSession();
    }
  }, [fontsLoaded, error]);

  useEffect(() => {
    getHasSeenOnboarding().then(setHasSeenOnboardingState);
  }, []);

  useEffect(() => {
    // icloud-unavailable renders the ICloudGate in place of the Stack below,
    // so it doesn't need (or want) a route change.
    if (status === "loading" || status === "idle" || status === "icloud-unavailable") return;
    // Wait for the onboarding flag before deciding where an unauthenticated
    // user should land.
    if (status === "unauthenticated" && hasSeenOnboarding === null) return;

    const inPreAuth = segments[0] === "auth" || segments[0] === "migrate" || segments[0] === "onboarding";

    if (status === "unauthenticated" && !inPreAuth) {
      if (!navigationAttempted.current) {
        navigationAttempted.current = true;
        router.replace(hasSeenOnboarding ? "/auth" : "/onboarding");
      }
    } else if (status === "authenticated" && inPreAuth) {
      if (!navigationAttempted.current) {
        navigationAttempted.current = true;
        router.replace("/");
      }
    } else {
      // Reset flag when in correct route
      navigationAttempted.current = false;
    }
  }, [status, segments, hasSeenOnboarding]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {status === "icloud-unavailable" ? (
        <ICloudGate />
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}

      {/* Badge celebration modal - shows when user earns a new badge */}
      <BadgeCelebration
        badge={celebratingBadge}
        visible={!!celebratingBadge}
        onDismiss={dismissBadgeCelebration}
      />
    </GestureHandlerRootView>
  );
}
