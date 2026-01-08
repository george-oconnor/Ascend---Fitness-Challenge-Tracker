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
  private AppleHealthKit: any = null;
  private moduleLoadAttempted = false;
  private moduleLoadError: string | null = null;

  /**
   * Lazy-load the HealthKit module when first needed
   */
  private loadModule(): boolean {
    if (this.moduleLoadAttempted) {
      return this.AppleHealthKit !== null;
    }

    this.moduleLoadAttempted = true;

    if (Platform.OS !== "ios") {
      this.moduleLoadError = "HealthKit is only available on iOS";
      return false;
    }

    try {
      // Direct require - let it fail naturally if not available
      const HealthKitModule = require("react-native-health");
      this.AppleHealthKit = HealthKitModule.default || HealthKitModule;
      
      // Verify the module has the methods we need
      if (!this.AppleHealthKit || typeof this.AppleHealthKit.initHealthKit !== "function") {
        this.moduleLoadError = "HealthKit module loaded but initHealthKit method not found";
        this.AppleHealthKit = null;
        return false;
      }

      console.log("✅ react-native-health module loaded successfully");
      return true;
    } catch (error: any) {
      this.moduleLoadError = error?.message || "Failed to load react-native-health";
      console.log("❌ Failed to load react-native-health:", this.moduleLoadError);
      return false;
    }
  }

  /**
   * Build permissions object
   */
  private getPermissions() {
    if (!this.AppleHealthKit?.Constants?.Permissions) {
      return { permissions: { read: [], write: [] } };
    }

    return {
      permissions: {
        read: [
          this.AppleHealthKit.Constants.Permissions.StepCount,
          this.AppleHealthKit.Constants.Permissions.Workout,
          this.AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          this.AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
        ],
        write: [],
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
    return this.AppleHealthKit !== null;
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
    if (Platform.OS !== "ios") {
      console.log("HealthKit is only available on iOS");
      return false;
    }

    // Try to load module
    if (!this.loadModule()) {
      console.warn("HealthKit native module not available:", this.moduleLoadError);
      return false;
    }

    const permissions = this.getPermissions();

    return new Promise((resolve) => {
      try {
        this.AppleHealthKit.initHealthKit(permissions, (error: any) => {
          if (error) {
            console.error("Error initializing HealthKit:", error);
            this.isInitialized = false;
            this.isAuthorized = false;
            resolve(false);
            return;
          }

          console.log("✅ HealthKit initialized successfully");
          this.isInitialized = true;
          this.isAuthorized = true;
          resolve(true);
        });
      } catch (error: any) {
        console.error("Exception calling initHealthKit:", error);
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
        this.AppleHealthKit.getStepCount(options, (error: any, results: any) => {
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
    if (!this.isNativeModuleLinked()) return [];

    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return [];
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

    return new Promise((resolve) => {
      try {
        this.AppleHealthKit.getSamples(options, (error: any, results: any) => {
          if (error) {
            console.error("Error getting workouts:", error);
            resolve([]);
            return;
          }

          if (!results || results.length === 0) {
            resolve([]);
            return;
          }

          const workouts: WorkoutData[] = results.map((workout: any) => {
            const activityType = workout.activityId || 0;
            const workoutInfo = getWorkoutInfo(activityType);

            const startDate = new Date(workout.start || workout.startDate);
            const endDate = new Date(workout.end || workout.endDate);
            const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

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

          resolve(workouts);
        });
      } catch (error) {
        console.error("Exception getting workouts:", error);
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
}

// Export singleton instance
export const healthService = new HealthService();
