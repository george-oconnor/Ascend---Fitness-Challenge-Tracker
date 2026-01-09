import { getCycleLog } from "@/lib/appwrite";
import { useSessionStore } from "@/store/useSessionStore";
import { CycleLog } from "@/types/type.d";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/**
 * Hook to check if cycle was logged today
 * Automatically refetches when screen is focused
 */
export function useTodayCycleLog() {
  const { user } = useSessionStore();
  const [cycleLog, setCycleLog] = useState<CycleLog | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCycleLog = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const log = await getCycleLog(user.id, today);
      setCycleLog(log);
    } catch (err) {
      console.error("Failed to fetch today's cycle log:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refetch when screen is focused (e.g., returning from log-cycle screen)
  useFocusEffect(
    useCallback(() => {
      fetchCycleLog();
    }, [fetchCycleLog])
  );

  const hasLoggedToday = !!cycleLog;

  return { cycleLog, hasLoggedToday, loading, refetch: fetchCycleLog };
}
