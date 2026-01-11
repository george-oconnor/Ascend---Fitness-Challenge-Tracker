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
};

// Map Apple's workout activity types to readable names
const WORKOUT_TYPE_MAP: Record<number, { name: string; isOutdoor: boolean }> = {
  // Outdoor activities
  37: { name: "Running", isOutdoor: true },
  52: { name: "Walking", isOutdoor: true },
  13: { name: "Cycling", isOutdoor: true },
  24: { name: "Hiking", isOutdoor: true },
  46: { name: "Swimming (Open Water)", isOutdoor: true },
  // Indoor activities
  20: { name: "Functional Training", isOutdoor: false },
  50: { name: "Traditional Strength Training", isOutdoor: false },
  25: { name: "High Intensity Interval Training", isOutdoor: false },
  35: { name: "Pilates", isOutdoor: false },
  63: { name: "Yoga", isOutdoor: false },
  45: { name: "Swimming (Pool)", isOutdoor: false },
  19: { name: "Elliptical", isOutdoor: false },
  83: { name: "Indoor Running", isOutdoor: false },
  // Default
  0: { name: "Other Workout", isOutdoor: false },
};

function getWorkoutInfo(activityType: number): { name: string; isOutdoor: boolean } {
  return WORKOUT_TYPE_MAP[activityType] || WORKOUT_TYPE_MAP[0];
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

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const options = {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    };

    return new Promise((resolve) => {
      try {
        this.HealthKit.getStepCount(options, (error: any, results: any) => {
          if (error) {
            console.error("Error getting steps:", error);
            resolve(0);
            return;
          }
          resolve(results?.value || 0);
        });
      } catch (error) {
        console.error("Exception getting steps:", error);
        resolve(0);
      }
    });
  }

  /**
   * Get workouts for a specific date
   */
  async getWorkoutsForDate(date: Date): Promise<WorkoutData[]> {
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
    
    return new Promise((resolve) => {
      try {
        this.HealthKit.getSamples(options, (error: any, results: any) => {
          if (error) {
            logger.error("HealthKit getSamples error", {
              error: error?.message || String(error),
              errorType: typeof error,
              options,
            });
            resolve([]);
            return;
          }

          logger.info("HealthKit getSamples response", {
            resultsCount: results?.length || 0,
            resultsType: typeof results,
            isArray: Array.isArray(results),
            firstResult: results?.[0] ? JSON.stringify(results[0]).slice(0, 200) : null,
          });
          
          if (results?.length > 0) {
            console.log("🏋️ First workout raw data:", JSON.stringify(results[0]));
          }

          if (!results || results.length === 0) {
            console.log("🏋️ getWorkoutsForDate: No workouts found for today");
            logger.warn("HealthKit returned no workouts", {
              dateRange: { start: options.startDate, end: options.endDate },
            });
            resolve([]);
            return;
          }

          const workouts: WorkoutData[] = results.map((workout: any) => {
            const activityType = workout.activityId || 0;
            const workoutInfo = getWorkoutInfo(activityType);

            const startDate = new Date(workout.start || workout.startDate);
            const endDate = new Date(workout.end || workout.endDate);
            const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

            console.log(`🏋️ Processing workout: ${workoutInfo.name}, duration: ${Math.round(duration)}min, activityId: ${activityType}`);

            return {
              id: workout.id || `${startDate.getTime()}`,
              activityType: String(activityType),
              activityName: workoutInfo.name,
              duration: Math.round(duration),
              calories: workout.calories || 0,
              distance: workout.distance || undefined,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              isOutdoor: workoutInfo.isOutdoor,
            };
          });

          console.log(`🏋️ getWorkoutsForDate: Returning ${workouts.length} workouts`);
          resolve(workouts);
        });
      } catch (error: any) {
        console.error("Exception getting workouts:", error);
        logger.error("HealthKit workout fetch exception", {
          error: error?.message || String(error),
          dateRange: { start: options.startDate, end: options.endDate },
        });
        resolve([]);
      }
    });
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
