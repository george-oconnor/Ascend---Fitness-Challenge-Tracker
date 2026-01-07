import { Platform } from "react-native";
import AppleHealthKit, {
    HealthInputOptions,
    HealthKitPermissions
} from "react-native-health";

// Permissions we need
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [],
  },
};

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
  37: { name: "Indoor Running", isOutdoor: false },
  // Default
  0: { name: "Other Workout", isOutdoor: false },
};

function getWorkoutInfo(activityType: number): { name: string; isOutdoor: boolean } {
  return WORKOUT_TYPE_MAP[activityType] || WORKOUT_TYPE_MAP[0];
}

class HealthService {
  private isInitialized = false;
  private isAuthorized = false;

  /**
   * Check if HealthKit is available on this device
   */
  isAvailable(): boolean {
    if (Platform.OS !== "ios") {
      return false;
    }
    return AppleHealthKit.isAvailable((err, available) => {
      return !err && available;
    });
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== "ios") {
      console.log("HealthKit is only available on iOS");
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error) => {
        if (error) {
          console.error("Error initializing HealthKit:", error);
          this.isInitialized = false;
          this.isAuthorized = false;
          resolve(false);
          return;
        }

        console.log("HealthKit initialized successfully");
        this.isInitialized = true;
        this.isAuthorized = true;
        resolve(true);
      });
    });
  }

  /**
   * Get step count for a specific date
   */
  async getStepsForDate(date: Date): Promise<number> {
    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return 0;
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    };

    return new Promise((resolve) => {
      AppleHealthKit.getStepCount(options, (error, results) => {
        if (error) {
          console.error("Error getting steps:", error);
          resolve(0);
          return;
        }
        resolve(results?.value || 0);
      });
    });
  }

  /**
   * Get workouts for a specific date
   */
  async getWorkoutsForDate(date: Date): Promise<WorkoutData[]> {
    if (!this.isAuthorized) {
      const initialized = await this.initialize();
      if (!initialized) return [];
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const options: HealthInputOptions = {
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
      type: "Workout",
    };

    return new Promise((resolve) => {
      AppleHealthKit.getSamples(options, (error, results) => {
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
          const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes

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
      isAvailable: Platform.OS === "ios",
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
      ? workouts.filter(w => w.isOutdoor) 
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
