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
  // Don't call isNativeModuleLinked at store creation - it's called lazily now
  isNativeModuleAvailable: false,
  isAvailable: false,
  isAuthorized: false,
  isLoading: false,
  steps: 0,
  workouts: [],
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    
    // Check if native module is available (this triggers lazy loading)
    const isLinked = healthService.isNativeModuleLinked();
    set({ isNativeModuleAvailable: isLinked });
    
    if (!isLinked) {
      const loadError = healthService.getModuleLoadError();
      set({ 
        error: loadError || "Apple Health requires a development or TestFlight build.",
        isLoading: false,
        isNativeModuleAvailable: false,
      });
      console.log("HealthKit module not linked. Error:", loadError);
      return false;
    }
    
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
