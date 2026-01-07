import { healthService, WorkoutData } from "@/lib/health";
import { captureException } from "@/lib/sentry";
import { create } from "zustand";

type HealthState = {
  isNativeModuleAvailable: boolean;
  isAvailable: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
  steps: number;
  workouts: WorkoutData[];
  error: string | null;

  // Actions
  initialize: () => Promise<boolean>;
  fetchTodayData: () => Promise<void>;
  checkStepGoal: (goal: number) => boolean;
  getOutdoorWorkoutMinutes: () => number;
  getTotalWorkoutMinutes: () => number;
};

export const useHealthStore = create<HealthState>((set, get) => ({
  isNativeModuleAvailable: healthService.isNativeModuleLinked(),
  isAvailable: false,
  isAuthorized: false,
  isLoading: false,
  steps: 0,
  workouts: [],
  error: null,

  initialize: async () => {
    // Check if native module is available first
    if (!healthService.isNativeModuleLinked()) {
      set({ 
        error: "Apple Health requires a development build. Expo Go is not supported.",
        isLoading: false,
        isNativeModuleAvailable: false,
      });
      return false;
    }
    
    set({ isLoading: true, error: null });
    try {
      const authorized = await healthService.initialize();
      set({ 
        isAuthorized: authorized, 
        isAvailable: true,
        isLoading: false 
      });
      
      if (authorized) {
        // Fetch today's data after initialization
        await get().fetchTodayData();
      }
      
      return authorized;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to initialize HealthKit";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg, isLoading: false, isAvailable: false });
      return false;
    }
  },

  fetchTodayData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await healthService.getTodayHealthData();
      set({
        steps: data.steps,
        workouts: data.workouts,
        isAvailable: data.isAvailable,
        isAuthorized: data.isAuthorized,
        isLoading: false,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch health data";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ error: errorMsg, isLoading: false });
    }
  },

  checkStepGoal: (goal: number) => {
    return get().steps >= goal;
  },

  getOutdoorWorkoutMinutes: () => {
    return get().workouts
      .filter((w) => w.isOutdoor)
      .reduce((total, w) => total + w.duration, 0);
  },

  getTotalWorkoutMinutes: () => {
    return get().workouts.reduce((total, w) => total + w.duration, 0);
  },
}));
