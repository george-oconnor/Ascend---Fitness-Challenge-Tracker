import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Store environment globally so logger can access it
let currentEnvironment = "development";

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

  // Fallback: Default to staging for non-dev builds so we get debug logs
  return "staging";
}

export function initSentry() {
  if (!dsn) {
    console.warn("⚠️ Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  const environment = getEnvironment();
  currentEnvironment = environment; // Store for logger use

  Sentry.init({
    dsn,
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    tracesSampleRate: environment === "production" ? 0.2 : 1.0,
    // Set environment based on build type
    environment,
    // Enable native crash reporting
    enableNative: true,
    // Enable auto session tracking
    enableAutoSessionTracking: true,
    // Enable automatic breadcrumbs
    enableNativeCrashHandling: true,
    // Debug mode for staging to see what's happening
    debug: environment === "staging",
  });

  // Send a test message on init to verify Sentry is working
  if (environment !== "development") {
    Sentry.addBreadcrumb({
      category: "app.lifecycle",
      message: `App initialized (${environment})`,
      level: "info",
    });
  }

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

/**
 * Structured logger that sends events to Sentry
 * In non-development builds, info logs are also sent as events for debugging
 */
export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    console.log(`ℹ️ ${message}`, data || "");
    
    // Always add breadcrumb for debugging
    Sentry.addBreadcrumb({
      category: "app.log",
      message,
      data,
      level: "info",
    });
    
    // In non-dev builds, also send info logs as events so we can see them in Sentry
    if (!__DEV__) {
      // Use withScope to isolate this message
      Sentry.withScope((scope) => {
        if (data) {
          scope.setContext("log_data", data);
        }
        scope.setTag("log_type", "debug_info");
        scope.setLevel("info");
        Sentry.captureMessage(`[DEBUG] ${message}`);
      });
    }
  },
  
  warn: (message: string, data?: Record<string, any>) => {
    console.warn(`⚠️ ${message}`, data || "");
    
    Sentry.addBreadcrumb({
      category: "app.log",
      message,
      data,
      level: "warning",
    });
    
    // Use withScope to isolate this message
    Sentry.withScope((scope) => {
      if (data) {
        scope.setContext("log_data", data);
      }
      scope.setTag("log_type", "warning");
      scope.setLevel("warning");
      Sentry.captureMessage(`[WARN] ${message}`);
    });
  },
  
  error: (message: string, data?: Record<string, any>) => {
    console.error(`❌ ${message}`, data || "");
    
    Sentry.addBreadcrumb({
      category: "app.log",
      message,
      data,
      level: "error",
    });
    
    // Use withScope to isolate this message
    Sentry.withScope((scope) => {
      if (data) {
        scope.setContext("log_data", data);
      }
      scope.setTag("log_type", "error");
      scope.setLevel("error");
      Sentry.captureMessage(`[ERROR] ${message}`);
    });
  },
  
  debug: (message: string, data?: Record<string, any>) => {
    if (__DEV__) {
      console.log(`🔍 ${message}`, data || "");
    }
    Sentry.addBreadcrumb({
      category: "app.debug",
      message,
      data,
      level: "debug",
    });
  },
};
