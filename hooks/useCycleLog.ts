import { getCycleLog } from "@/lib/appwrite";
import { useSessionStore } from "@/store/useSessionStore";
import { CycleLog } from "@/types/type.d";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";

// Centralized store for cycle log to prevent duplicate API calls
type CycleLogState = {
  cycleLog: CycleLog | null;
  loading: boolean;
  lastFetchDate: string | null;
  lastFetchTime: number;
  fetchCycleLog: (userId: string, forceRefresh?: boolean) => Promise<void>;
  clearCycleLog: () => void;
};

const useCycleLogStore = create<CycleLogState>((set, get) => ({
  cycleLog: null,
  loading: false,
  lastFetchDate: null,
  lastFetchTime: 0,

  fetchCycleLog: async (userId: string, forceRefresh = false) => {
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();
    const { lastFetchDate, lastFetchTime, loading } = get();
    
    // Skip if already loading
    if (loading) return;
    
    // Skip if we already fetched for today within the last 5 seconds (debounce)
    // unless forceRefresh is true
    if (!forceRefresh && lastFetchDate === today && now - lastFetchTime < 5000) {
      return;
    }

    set({ loading: true });
    try {
      const log = await getCycleLog(userId, today);
      set({ 
        cycleLog: log, 
        loading: false, 
        lastFetchDate: today,
        lastFetchTime: now,
      });
    } catch (err) {
      console.error("Failed to fetch today's cycle log:", err);
      set({ loading: false });
    }
  },

  clearCycleLog: () => set({ cycleLog: null, lastFetchDate: null, lastFetchTime: 0 }),
}));

/**
 * Hook to check if cycle was logged today
 * Uses centralized store to prevent duplicate API calls
 * Automatically refetches when screen is focused
 */
export function useTodayCycleLog() {
  const { user } = useSessionStore();
  const { cycleLog, loading, fetchCycleLog } = useCycleLogStore();
  const initialFetchDone = useRef(false);

  // Initial fetch
  useEffect(() => {
    if (user?.id && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchCycleLog(user.id);
    }
  }, [user?.id, fetchCycleLog]);

  // Refetch when screen is focused (e.g., returning from log-cycle screen)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        // Force refresh on focus to catch updates from log-cycle screen
        fetchCycleLog(user.id, true);
      }
    }, [user?.id, fetchCycleLog])
  );

  const hasLoggedToday = !!cycleLog;

  return { 
    cycleLog, 
    hasLoggedToday, 
    loading, 
    refetch: () => user?.id ? fetchCycleLog(user.id, true) : Promise.resolve(),
  };
}
