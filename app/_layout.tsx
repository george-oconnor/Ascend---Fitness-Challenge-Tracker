import { initSentry } from "@/lib/sentry";
import { useSessionStore } from "@/store/useSessionStore";
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import './globals.css';

// Initialize Sentry before app renders
initSentry();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "QuickSand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
    "QuickSand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
    "QuickSand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
    "QuickSand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
    "QuickSand-Light": require("../assets/fonts/Quicksand-Light.ttf"),
  });

  const { checkSession, status } = useSessionStore();
  const router = useRouter();
  const segments = useSegments();
  const navigationAttempted = useRef(false);

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
    </GestureHandlerRootView>
  );
}
