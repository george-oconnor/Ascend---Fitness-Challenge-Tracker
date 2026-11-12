import { logger } from "@/lib/sentry";
import { Platform } from "react-native";

export type HealthData = {
  steps: number;
  workouts: WorkoutData[];
  isAvailable: boolean;
  isAuthorized: boolean;
};

export type WorkoutData = {
  id: string;
  activityType: string;
  activityName: string;
  duration: number; // minutes
  calories: number;
  distance?: number; // meters
  startDate: string;
  endDate: string;
  isOutdoor: boolean;
  sourceName?: string; // the app HealthKit attributes this sample to, e.g. "Strava"
};

// Apple's HKWorkoutActivityType raw values (the `activityId` react-native-health
// returns) mapped to readable names. Names follow Apple's, so they match the
// `activityName` react-native-health sends once spaces are ignored. isOutdoor is
// the default for the activity; a workout's own HKIndoorWorkout / swimming
// location metadata overrides it (see isOutdoorWorkout).
const WORKOUT_TYPE_MAP: Record<number, { name: string; isOutdoor: boolean }> = {
  1: { name: "American Football", isOutdoor: true },
  2: { name: "Archery", isOutdoor: true },
  3: { name: "Australian Football", isOutdoor: true },
  4: { name: "Badminton", isOutdoor: true },
  5: { name: "Baseball", isOutdoor: true },
  6: { name: "Basketball", isOutdoor: true },
  7: { name: "Bowling", isOutdoor: false },
  8: { name: "Boxing", isOutdoor: false },
  9: { name: "Climbing", isOutdoor: true },
  10: { name: "Cricket", isOutdoor: true },
  11: { name: "Cross Training", isOutdoor: false },
  12: { name: "Curling", isOutdoor: false },
  13: { name: "Cycling", isOutdoor: true },
  14: { name: "Dance", isOutdoor: false },
  15: { name: "Dance Inspired Training", isOutdoor: false },
  16: { name: "Elliptical", isOutdoor: false },
  17: { name: "Equestrian Sports", isOutdoor: true },
  18: { name: "Fencing", isOutdoor: false },
  19: { name: "Fishing", isOutdoor: true },
  20: { name: "Functional Strength Training", isOutdoor: false },
  21: { name: "Golf", isOutdoor: true },
  22: { name: "Gymnastics", isOutdoor: false },
  23: { name: "Handball", isOutdoor: true },
  24: { name: "Hiking", isOutdoor: true },
  25: { name: "Hockey", isOutdoor: true },
  26: { name: "Hunting", isOutdoor: true },
  27: { name: "Lacrosse", isOutdoor: true },
  28: { name: "Martial Arts", isOutdoor: false },
  29: { name: "Mind And Body", isOutdoor: false },
  30: { name: "Mixed Metabolic Cardio Training", isOutdoor: false },
  31: { name: "Paddle Sports", isOutdoor: true },
  32: { name: "Play", isOutdoor: true },
  33: { name: "Preparation And Recovery", isOutdoor: false },
  34: { name: "Racquetball", isOutdoor: false },
  35: { name: "Rowing", isOutdoor: true },
  36: { name: "Rugby", isOutdoor: true },
  37: { name: "Running", isOutdoor: true },
  38: { name: "Sailing", isOutdoor: true },
  39: { name: "Skating Sports", isOutdoor: true },
  40: { name: "Snow Sports", isOutdoor: true },
  41: { name: "Soccer", isOutdoor: true },
  42: { name: "Softball", isOutdoor: true },
  43: { name: "Squash", isOutdoor: false },
  44: { name: "Stair Climbing", isOutdoor: false },
  45: { name: "Surfing Sports", isOutdoor: true },
  46: { name: "Swimming", isOutdoor: false },
  47: { name: "Table Tennis", isOutdoor: false },
  48: { name: "Tennis", isOutdoor: true },
  49: { name: "Track And Field", isOutdoor: true },
  50: { name: "Traditional Strength Training", isOutdoor: false },
  51: { name: "Volleyball", isOutdoor: true },
  52: { name: "Walking", isOutdoor: true },
  53: { name: "Water Fitness", isOutdoor: false },
  54: { name: "Water Polo", isOutdoor: true },
  55: { name: "Water Sports", isOutdoor: true },
  56: { name: "Wrestling", isOutdoor: false },
  57: { name: "Yoga", isOutdoor: false },
  58: { name: "Barre", isOutdoor: false },
  59: { name: "Core Training", isOutdoor: false },
  60: { name: "Cross Country Skiing", isOutdoor: true },
  61: { name: "Downhill Skiing", isOutdoor: true },
  62: { name: "Flexibility", isOutdoor: false },
  63: { name: "High Intensity Interval Training", isOutdoor: false },
  64: { name: "Jump Rope", isOutdoor: false },
  65: { name: "Kickboxing", isOutdoor: false },
  66: { name: "Pilates", isOutdoor: false },
  67: { name: "Snowboarding", isOutdoor: true },
  68: { name: "Stairs", isOutdoor: false },
  69: { name: "Step Training", isOutdoor: false },
  70: { name: "Wheelchair Walk Pace", isOutdoor: true },
  71: { name: "Wheelchair Run Pace", isOutdoor: true },
  72: { name: "Tai Chi", isOutdoor: false },
  73: { name: "Mixed Cardio", isOutdoor: false },
  74: { name: "Hand Cycling", isOutdoor: true },
  75: { name: "Disc Sports", isOutdoor: true },
  76: { name: "Fitness Gaming", isOutdoor: false },
  77: { name: "Cardio Dance", isOutdoor: false },
  78: { name: "Social Dance", isOutdoor: false },
  79: { name: "Pickleball", isOutdoor: true },
  80: { name: "Cooldown", isOutdoor: false },
  82: { name: "Swim Bike Run", isOutdoor: true },
  83: { name: "Transition", isOutdoor: false },
  84: { name: "Underwater Diving", isOutdoor: true },
  // Default
  0: { name: "Other Workout", isOutdoor: false },
  3000: { name: "Other", isOutdoor: false },
};

/** "HighIntensityIntervalTraining" and "High Intensity Interval Training" compare equal. */
function normalizeWorkoutName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Whether a HealthKit workout happened outdoors: the activity's default,
 * overridden by what the recording device said (an indoor run on a treadmill
 * has HKIndoorWorkout = 1; a swim has HKSwimmingLocationType 1 = pool,
 * 2 = open water).
 */
function isOutdoorWorkout(defaultIsOutdoor: boolean, metadata: any): boolean {
  const indoor = metadata?.HKIndoorWorkout;
  if (indoor === 1 || indoor === true) return false;
  const swimLocation = metadata?.HKSwimmingLocationType;
  if (swimLocation === 1) return false;
  if (swimLocation === 2) return true;
  return defaultIsOutdoor;
}

/**
 * At cold/background launch, HealthKit's store is protected by the same
 * `NSFileProtectionCompleteUntilFirstUserAuthentication` class as the keychain,
 * so queries can fail for a window before the device's first unlock even
 * though HealthKit reports the app as authorized. lib/auth.ts hit the
 * identical race with SecureStore (Sentry 75-HARD-APP-1R); retry these
 * callback-style HealthKit queries with the same exponential backoff.
 */
function isProtectedHealthDataError(error: any): boolean {
  const message = error?.message || String(error);
  return message.includes("Protected health data is inaccessible") || message.includes("AppleHealthKit error 0");
}

/**
 * Thrown (only when asked for, see getWorkoutsForDate) when HealthKit is still
 * locked after the retries above: typically a background launch while the
 * phone is locked. Callers that would otherwise treat "no workouts" as real
 * data, like the daily log resync, catch this and skip the sync instead.
 */
export class HealthDataLockedError extends Error {
  constructor() {
    super("Apple Health data is locked until the phone is unlocked");
    this.name = "HealthDataLockedError";
  }
}

function queryHealthKitWithRetry<T>(
  runQuery: (callback: (error: any, results: T) => void) => void,
  attempts = 7,
  baseDelayMs = 150
): Promise<{ error: any; results?: T }> {
  return new Promise((resolve) => {
    const attempt = (attemptNumber: number) => {
      runQuery((error, results) => {
        if (error && isProtectedHealthDataError(error) && attemptNumber < attempts) {
          const delayMs = Math.min(baseDelayMs * 2 ** (attemptNumber - 1), 1500);
          setTimeout(() => attempt(attemptNumber + 1), delayMs);
          return;
        }
        resolve({ error, results });
      });
    };
    attempt(1);
  });
}

function getWorkoutInfo(activityType: number): { name: string; isOutdoor: boolean; isUnknown?: boolean } {
  const info = WORKOUT_TYPE_MAP[activityType];
  if (info) {
    return info;
  }
  // Log unknown workout type to Sentry for future mapping
  logger.warn("Unknown workout type from Apple Health", { 
    activityType, 
    message: `Workout type ${activityType} not mapped - defaulting to "Other Workout"`
  });
  return { ...WORKOUT_TYPE_MAP[0], isUnknown: true };
}

class HealthService {
  private isInitialized = false;
  private isAuthorized = false;
  private HealthKit: any = null;
  private moduleLoadAttempted = false;
  private moduleLoadError: string | null = null;

  /**
   * Lazy-load the HealthKit module when first needed
   */
  private loadModule(): boolean {
    if (this.moduleLoadAttempted) {
      return this.HealthKit !== null;
    }

    this.moduleLoadAttempted = true;
    logger.info("HealthKit loadModule started", { platform: Platform.OS });

    if (Platform.OS !== "ios") {
      this.moduleLoadError = "HealthKit is only available on iOS";
      logger.warn("HealthKit not available", { reason: "not iOS", platform: Platform.OS });
      return false;
    }

    try {
      // Import the library - with our patch, it uses a Proxy for lazy loading
      logger.info("HealthKit importing react-native-health module");
      const HealthKitModule = require("react-native-health");
      
      // The library exports as module.exports = HealthKit
      this.HealthKit = HealthKitModule.HealthKit || HealthKitModule.default || HealthKitModule;
      
      // With the Proxy patch, initHealthKit won't show up until we access it
      // So we try to access it to trigger lazy loading
      const hasInitHealthKit = typeof this.HealthKit?.initHealthKit === "function";
      
      logger.info("HealthKit module load result", {
        hasModule: !!this.HealthKit,
        hasInitHealthKit,
        hasConstants: !!this.HealthKit?.Constants,
        moduleKeys: this.HealthKit ? Object.keys(this.HealthKit).slice(0, 10) : [],
      });

      if (!hasInitHealthKit) {
        this.moduleLoadError = "HealthKit native module not linked - initHealthKit not available";
        logger.warn("HealthKit initHealthKit not found", { moduleLoadError: this.moduleLoadError });
        this.HealthKit = null;
        return false;
      }

      logger.info("HealthKit module loaded successfully");
      return true;
    } catch (error: any) {
      this.moduleLoadError = error?.message || "Failed to load react-native-health";
      logger.error("HealthKit module load failed", { error: this.moduleLoadError });
      return false;
    }
  }

  /**
   * Build permissions object
   */
  private getPermissions() {
    if (!this.HealthKit?.Constants?.Permissions) {
      return { permissions: { read: [], write: [] } };
    }

    return {
      permissions: {
        read: [
          this.HealthKit.Constants.Permissions.StepCount,
          this.HealthKit.Constants.Permissions.Workout,
          this.HealthKit.Constants.Permissions.ActiveEnergyBurned,
          this.HealthKit.Constants.Permissions.DistanceWalkingRunning,
          this.HealthKit.Constants.Permissions.BodyMass,
          this.HealthKit.Constants.Permissions.EnergyConsumed,
        ],
        write: [
          this.HealthKit.Constants.Permissions.BodyMass,
          this.HealthKit.Constants.Permissions.Workout,
          this.HealthKit.Constants.Permissions.EnergyConsumed,
        ],
      },
    };
  }

  /**
   * Check if HealthKit native module is linked and available
   * This is the key method for UI to determine whether to show "requires dev build" message
   */
  isNativeModuleLinked(): boolean {
    // Try to load the module if we haven't yet
    if (!this.moduleLoadAttempted) {
      this.loadModule();
    }
    return this.HealthKit !== null;
  }

  /**
   * Get the error message if module failed to load
   */
  getModuleLoadError(): string | null {
    return this.moduleLoadError;
  }

  /**
   * Check if HealthKit is available on this device
   */
  isAvailable(): boolean {
    return Platform.OS === "ios" && this.isNativeModuleLinked();
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    logger.info("HealthKit initialize called", { platform: Platform.OS });
    
    if (Platform.OS !== "ios") {
      logger.warn("HealthKit initialize skipped", { reason: "not iOS" });
      return false;
    }

    // Try to load module
    if (!this.loadModule()) {
      logger.warn("HealthKit initialize failed", { reason: "module not loaded", error: this.moduleLoadError });
      return false;
    }

    const permissions = this.getPermissions();
    logger.info("HealthKit requesting permissions", { 
      readPermissions: permissions.permissions.read.length,
      writePermissions: permissions.permissions.write.length,
    });

    return new Promise((resolve) => {
      try {
        this.HealthKit.initHealthKit(permissions, (error: any) => {
          if (error) {
            logger.error("HealthKit initHealthKit callback error", { 
              error: error?.message || String(error),
              errorType: typeof error,
            });
            this.isInitialized = false;
            this.isAuthorized = false;
            resolve(false);
            return;
          }

          logger.info("HealthKit initialized and authorized successfully");
          this.isInitialized = true;
          this.isAuthorized = true;
          resolve(true);
        });
      } catch (error: any) {
        logger.error("HealthKit initHealthKit exception", { error: error?.message || String(error) });
        this.moduleLoadError = error?.message || "Exception during HealthKit init";
        this.isInitialized = false;
        this.isAuthorized = false;
        resolve(false);
      }
    });
  }

  /**
   * Get step count for a specific date
   */
  async getStepsForDate(date: Date): Promise<number> {
    if (!this.isNativeModuleLinked()) return 0;

    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return 0;
    }

    // Use the 'date' option as per react-native-health getStepCount API
    // The API expects a 'date' field, not 'startDate'/'endDate'
    // If 'date' is not provided, it defaults to today - which caused the bug
    const options = {
      date: date.toISOString(),
    };

    try {
      const { error, results } = await queryHealthKitWithRetry<any>((callback) =>
        this.HealthKit.getStepCount(options, callback)
      );
      if (error) {
        console.error("Error getting steps:", error);
        return 0;
      }
      return results?.value || 0;
    } catch (error) {
      console.error("Exception getting steps:", error);
      return 0;
    }
  }

  /**
   * Get workouts for a specific date
   */
  async getWorkoutsForDate(
    date: Date,
    { throwIfLocked = false }: { throwIfLocked?: boolean } = {}
  ): Promise<WorkoutData[]> {
    logger.info("HealthKit getWorkoutsForDate called", { 
      date: date.toISOString(),
      isModuleLinked: this.isNativeModuleLinked(),
      isAuthorized: this.isAuthorized,
    });
    
    if (!this.isNativeModuleLinked()) {
      logger.warn("HealthKit getWorkoutsForDate skipped", { reason: "module not linked" });
      return [];
    }

    if (!this.isAuthorized) {
      logger.info("HealthKit getWorkoutsForDate: not authorized, initializing...");
      const initialized = await this.initialize();
      if (!initialized) {
        logger.warn("HealthKit getWorkoutsForDate failed", { reason: "initialization failed" });
        return [];
      }
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const options = {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      type: "Workout",
    };

    logger.info("HealthKit getSamples request", { options });

    try {
      const { error, results } = await queryHealthKitWithRetry<any>((callback) =>
        this.HealthKit.getSamples(options, callback)
      );

      if (error && isProtectedHealthDataError(error)) {
        // Expected while the phone is locked (background launches), so only a
        // breadcrumb rather than an error event.
        logger.info("HealthKit workouts unavailable: phone locked", { options });
        if (throwIfLocked) throw new HealthDataLockedError();
        return [];
      }

      if (error) {
        logger.error("HealthKit getSamples error", {
          error: error?.message || String(error),
          errorType: typeof error,
          options,
        });
        return [];
      }

      logger.info("HealthKit getSamples response", {
        resultsCount: results?.length || 0,
        resultsType: typeof results,
        isArray: Array.isArray(results),
        firstResult: results?.[0] ? JSON.stringify(results[0]).slice(0, 200) : null,
      });

      if (results?.length > 0) {
        console.log("🏋️ First workout raw data (ALL PROPERTIES):", JSON.stringify(results[0], null, 2));
        console.log("🏋️ Available keys:", Object.keys(results[0]));
      }

      if (!results || results.length === 0) {
        console.log("🏋️ getWorkoutsForDate: No workouts found for today");
        logger.debug("HealthKit returned no workouts", {
          dateRange: { start: options.startDate, end: options.endDate },
        });
        return [];
      }

      const workouts: WorkoutData[] = results.map((workout: any) => {
        const activityType = workout.activityId || workout.activityType || 0;
        const workoutInfo = getWorkoutInfo(activityType);

        // react-native-health may return the activity name directly from Apple Health
        // Use it if available, otherwise fall back to our mapping
        const appleActivityName = workout.activityName || workout.type || workout.workoutActivityType;

        const startDate = new Date(workout.start || workout.startDate);
        const endDate = new Date(workout.end || workout.endDate);
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

        console.log(`🏋️ Processing workout:`, {
          ourMappedName: workoutInfo.name,
          appleActivityName,
          activityId: activityType,
          duration: Math.round(duration),
          allWorkoutKeys: Object.keys(workout),
        });

        // Prefer Apple's activity name if it exists and differs from our mapping
        // This handles cases where Apple returns a name we haven't mapped
        const finalActivityName = appleActivityName || workoutInfo.name;

        // Log to Sentry if there's a mismatch between Apple's name and our mapping
        if (appleActivityName && normalizeWorkoutName(appleActivityName) !== normalizeWorkoutName(workoutInfo.name)) {
          logger.warn("Workout type mismatch - Apple name differs from our mapping", {
            appleActivityName,
            ourMappedName: workoutInfo.name,
            activityId: activityType,
            rawWorkoutData: JSON.stringify(workout).slice(0, 500),
          });
        }

        return {
          id: workout.id || `${startDate.getTime()}`,
          activityType: String(activityType),
          activityName: finalActivityName,
          duration: Math.round(duration),
          calories: workout.calories || 0,
          distance: workout.distance || undefined,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isOutdoor: isOutdoorWorkout(workoutInfo.isOutdoor, workout.metadata),
          sourceName: workout.sourceName || undefined,
        };
      });

      console.log(`🏋️ getWorkoutsForDate: Returning ${workouts.length} workouts`);
      return workouts;
    } catch (error: any) {
      if (error instanceof HealthDataLockedError) throw error;
      console.error("Exception getting workouts:", error);
      logger.error("HealthKit workout fetch exception", {
        error: error?.message || String(error),
        dateRange: { start: options.startDate, end: options.endDate },
      });
      return [];
    }
  }

  /**
   * Get all health data for today
   */
  async getTodayHealthData(): Promise<HealthData> {
    const today = new Date();

    const [steps, workouts] = await Promise.all([
      this.getStepsForDate(today),
      this.getWorkoutsForDate(today),
    ]);

    return {
      steps,
      workouts,
      isAvailable: this.isAvailable(),
      isAuthorized: this.isAuthorized,
    };
  }

  /**
   * Check if step goal is met
   */
  async isStepGoalMet(goal: number): Promise<boolean> {
    const steps = await this.getStepsForDate(new Date());
    return steps >= goal;
  }

  /**
   * Check if workout goal is met (by minutes)
   */
  async getWorkoutMinutes(date: Date, outdoorOnly: boolean = false): Promise<number> {
    const workouts = await this.getWorkoutsForDate(date);

    const filteredWorkouts = outdoorOnly
      ? workouts.filter((w) => w.isOutdoor)
      : workouts;

    return filteredWorkouts.reduce((total, w) => total + w.duration, 0);
  }

  /**
   * Get authorization status
   */
  getAuthorizationStatus(): { isInitialized: boolean; isAuthorized: boolean } {
    return {
      isInitialized: this.isInitialized,
      isAuthorized: this.isAuthorized,
    };
  }

  /**
   * Get the most recent weight from Apple Health
   */
  async getLatestWeight(): Promise<number | null> {
    if (!this.isNativeModuleLinked()) return null;

    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return null;
    }

    const options = {
      unit: "kg",
      limit: 1,
    };

    return new Promise((resolve) => {
      try {
        this.HealthKit.getLatestWeight(options, (error: any, results: any) => {
          if (error) {
            console.error("Error getting weight:", error);
            resolve(null);
            return;
          }
          console.log("📊 Weight from Apple Health:", results);
          resolve(results?.value || null);
        });
      } catch (error) {
        console.error("Exception getting weight:", error);
        resolve(null);
      }
    });
  }

  /**
   * Save weight to Apple Health
   */
  async saveWeight(weightKg: number): Promise<boolean> {
    if (!this.isNativeModuleLinked()) return false;

    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    const options = {
      value: weightKg,
      unit: "kg",
      date: new Date().toISOString(),
    };

    return new Promise((resolve) => {
      try {
        this.HealthKit.saveWeight(options, (error: any, result: any) => {
          if (error) {
            console.error("Error saving weight to Apple Health:", error);
            resolve(false);
            return;
          }
          logger.info("Apple Health sync: weight saved (legacy)", { type: "weight", weightKg });
          resolve(true);
        });
      } catch (error) {
        console.error("Exception saving weight:", error);
        resolve(false);
      }
    });
  }

  /**
   * Save a workout to Apple Health
   */
  async saveWorkout(options: {
    type: string;
    startDate: Date;
    endDate: Date;
    calories?: number;
    distance?: number;
  }): Promise<boolean> {
    if (!this.isNativeModuleLinked()) return false;

    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    // Map our workout types to Apple's activity types
    const WORKOUT_TYPE_TO_APPLE: Record<string, string> = {
      running: "Running",
      walking: "Walking",
      cycling: "Cycling",
      hiking: "Hiking",
      swimming: "Swimming",
      strength: "TraditionalStrengthTraining",
      hiit: "HighIntensityIntervalTraining",
      yoga: "Yoga",
      pilates: "Pilates",
      crossfit: "CrossTraining",
      boxing: "Boxing",
      dance: "Dance",
      rowing: "Rowing",
      "indoor-rowing": "Rowing",
      other: "Other",
    };

    const activityType = WORKOUT_TYPE_TO_APPLE[options.type] || "Other";

    const workoutOptions: any = {
      type: activityType,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
    };

    if (options.calories && options.calories > 0) {
      workoutOptions.energyBurned = options.calories;
    }

    if (options.distance && options.distance > 0) {
      workoutOptions.distance = options.distance;
    }

    return new Promise((resolve) => {
      try {
        this.HealthKit.saveWorkout(workoutOptions, (error: any, result: any) => {
          if (error) {
            console.error("Error saving workout to Apple Health:", error);
            resolve(false);
            return;
          }
          const durationMinutes = Math.round((options.endDate.getTime() - options.startDate.getTime()) / 60000);
          logger.info("Apple Health sync: workout saved", { type: "workout", workoutType: options.type, durationMinutes });
          resolve(true);
        });
      } catch (error) {
        console.error("Exception saving workout:", error);
        resolve(false);
      }
    });
  }

  /**
   * Save food/calories to Apple Health
   */
  async saveFood(options: {
    foodName: string;
    mealType: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
    calories: number;
    date?: Date;
  }): Promise<boolean> {
    if (!this.isAuthorized) {
      console.log("HealthKit not authorized, skipping saveFood");
      return false;
    }

    if (!this.HealthKit?.saveFood) {
      console.log("saveFood not available");
      return false;
    }

    const foodOptions: any = {
      foodName: options.foodName,
      mealType: options.mealType,
      energy: options.calories,
      date: (options.date || new Date()).toISOString(),
    };

    return new Promise((resolve) => {
      try {
        this.HealthKit.saveFood(foodOptions, (error: any, result: any) => {
          if (error) {
            console.error("Error saving food to Apple Health:", error);
            resolve(false);
            return;
          }
          logger.info("Apple Health sync: food saved", { type: "food", mealType: options.mealType, calories: options.calories });
          resolve(true);
        });
      } catch (error) {
        console.error("Exception saving food:", error);
        resolve(false);
      }
    });
  }

  /**
   * Save all meals' calories to Apple Health
   */
  async saveMealCalories(meals: {
    breakfast?: number;
    lunch?: number;
    dinner?: number;
    snacks?: number;
  }): Promise<boolean> {
    const results: boolean[] = [];
    const now = new Date();

    if (meals.breakfast && meals.breakfast > 0) {
      results.push(await this.saveFood({
        foodName: "Breakfast",
        mealType: "Breakfast",
        calories: meals.breakfast,
        date: now,
      }));
    }

    if (meals.lunch && meals.lunch > 0) {
      results.push(await this.saveFood({
        foodName: "Lunch",
        mealType: "Lunch",
        calories: meals.lunch,
        date: now,
      }));
    }

    if (meals.dinner && meals.dinner > 0) {
      results.push(await this.saveFood({
        foodName: "Dinner",
        mealType: "Dinner",
        calories: meals.dinner,
        date: now,
      }));
    }

    if (meals.snacks && meals.snacks > 0) {
      results.push(await this.saveFood({
        foodName: "Snacks",
        mealType: "Snacks",
        calories: meals.snacks,
        date: now,
      }));
    }

    // Return true if at least one save succeeded
    return results.some((r) => r === true);
  }
}

// Export singleton instance
export const healthService = new HealthService();
