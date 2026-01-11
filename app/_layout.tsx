import { BadgeCelebration } from "@/components/BadgeCelebration";
import { captureMessage, initSentry, logger } from "@/lib/sentry";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import * as Notifications from "expo-notifications";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import './globals.css';

// Initialize Sentry before app renders
initSentry();

// Send a test message to verify Sentry is working (only in non-dev builds)
if (!__DEV__) {
  captureMessage("App started successfully", "info");
  // Also test logger.info to ensure it works
  logger.info("Logger test on startup", { 
    platform: Platform.OS,
    buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE,
    timestamp: new Date().toISOString()
  });
}

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "QuickSand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
    "QuickSand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
    "QuickSand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
    "QuickSand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
    "QuickSand-Light": require("../assets/fonts/Quicksand-Light.ttf"),
  });

  const { checkSession, status } = useSessionStore();
  const { initialize: initNotifications, celebratingBadge, dismissBadgeCelebration } = useNotificationStore();
  const router = useRouter();
  const segments = useSegments();
  const navigationAttempted = useRef(false);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Initialize notifications
  useEffect(() => {
    initNotifications();

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
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Handle deep links for password reset
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { hostname, path, queryParams } = Linking.parse(event.url);
      
      // Handle budgetapp://reset-password?userId=...&secret=...
      if (hostname === 'reset-password' || path === 'reset-password') {
        const userId = queryParams?.userId as string;
        const secret = queryParams?.secret as string;
        
        if (userId && secret) {
          router.push({
            pathname: '/auth/reset-password',
            params: { userId, secret }
          } as any);
        }
        return;
      }
    };

    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkSession();
    }
  }, [fontsLoaded, error]);

  useEffect(() => {
    if (status === "loading" || status === "idle") return;

    const inAuthGroup = segments[0] === "auth";

    if (status === "unauthenticated" && !inAuthGroup) {
      if (!navigationAttempted.current) {
        navigationAttempted.current = true;
        router.replace("/auth");
      }
    } else if (status === "authenticated" && inAuthGroup) {
      if (!navigationAttempted.current) {
        navigationAttempted.current = true;
        router.replace("/");
      }
    } else {
      // Reset flag when in correct route
      navigationAttempted.current = false;
    }
  }, [status, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      
      {/* Badge celebration modal - shows when user earns a new badge */}
      <BadgeCelebration
        badge={celebratingBadge}
        visible={!!celebratingBadge}
        onDismiss={dismissBadgeCelebration}
      />
    </GestureHandlerRootView>
  );
}
