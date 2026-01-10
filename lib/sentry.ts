import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Determine the environment based on build context:
 * - "development": Expo Go, simulator, or __DEV__ mode
 * - "staging": TestFlight/internal testing builds
 * - "production": App Store/production builds
 */
function getEnvironment(): string {
  // Check if running in development mode
  if (__DEV__) {
    return "development";
  }

  // Check app ownership to detect Expo Go
  const appOwnership = Constants.appOwnership;
  if (appOwnership === "expo") {
    return "development";
  }

  // Use the build profile environment variable set in eas.json
  const buildProfile = process.env.EXPO_PUBLIC_BUILD_PROFILE;
  
  if (buildProfile === "development" || buildProfile === "preview") {
    return "development";
  }
  
  if (buildProfile === "testflight" || buildProfile === "staging") {
    return "staging";
  }
  
  if (buildProfile === "production") {
    return "production";
  }

  // Fallback: Default to production for store builds
  return "production";
}

export function initSentry() {
  if (!dsn) {
    console.warn("⚠️ Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  const environment = getEnvironment();

  Sentry.init({
    dsn,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: environment === "production" ? 0.2 : 1.0,
    // Set environment based on build type
    environment,
    // Enable native crash reporting
    enableNative: true,
    // Enable auto session tracking
    enableAutoSessionTracking: true,
    // Enable automatic breadcrumbs
    enableNativeCrashHandling: true,
    // Enable structured logs
    enableLogs: true,
    // Only send 100% of logs in dev/staging, 50% in production
    beforeSendLog: (log) => {
      if (environment === "production" && Math.random() > 0.5) {
        return null;
      }
      return log;
    },
  });

  console.log(`✅ Sentry initialized (${environment})`);
}

// Helper to capture exceptions manually
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext("additional_context", context);
  }
  Sentry.captureException(error);
}

// Helper to capture messages
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

// Helper to set user context
export function setUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user);
}

// Helper to clear user context
export function clearUser() {
  Sentry.setUser(null);
}

// Export Sentry logger for structured logging
export const logger = Sentry.logger;
