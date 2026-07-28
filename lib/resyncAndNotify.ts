import { captureException, logger } from "@/lib/sentry";

const STEPS_MILESTONE_INTERVAL = 2000;

/**
 * Resyncs today's log (HealthKit + Strava) and fires a notification for any
 * genuinely new "obvious point" — a workout appearing, a goal being reached
 * (water/sleep/steps), a weight entry landing, a step-count milestone, or
 * the day completing. Shared by the HealthKit background-delivery handler
 * and the Strava silent-push handler (foreground listener and background
 * task) so all three wake-up paths notify consistently instead of drifting
 * apart — only the HealthKit path used to do this diffing.
 */
export async function resyncTodayAndNotify(): Promise<void> {
  try {
    const { useChallengeStore } = await import("@/store/useChallengeStore");
    const challengeState = useChallengeStore.getState();
    const challenge = challengeState.challenge;
    const challengeId = challenge?.$id;
    if (!challengeId || !challenge) return;

    if (!challengeState.todayLog) {
      await challengeState.fetchTodayLog(challengeId);
    }
    const before = useChallengeStore.getState().todayLog;
    const logId = before?.$id;
    if (!logId) return;

    // Something changed at the source (a HealthKit sample landed, or Strava
    // pushed a webhook), so bypass the Strava activity cache.
    await useChallengeStore
      .getState()
      .resyncHealthDataForDate(new Date(), logId, undefined, { forceStravaFetch: true });
    const after = useChallengeStore.getState().todayLog;
    if (!after) return;

    const { NotificationService } = await import("@/lib/notifications");
    const { useNotificationStore } = await import("@/store/useNotificationStore");
    const { isDayComplete } = await import("@/lib/dayCompletion");
    const notificationStore = useNotificationStore.getState();
    const today = new Date().toISOString().split("T")[0];

    // Workouts: notify on any minutes growth in a slot (a workout was detected)
    for (const slot of ["workout1", "workout2"] as const) {
      const grew = (after[`${slot}Minutes`] ?? 0) > (before?.[`${slot}Minutes`] ?? 0);
      if (!grew) continue;
      try {
        const details = after.workoutDetails ? JSON.parse(after.workoutDetails) : {};
        await NotificationService.notifyWorkoutDetected(
          after[`${slot}Minutes`] ?? 0,
          details[slot]?.activityName
        );
      } catch (err) {
        logger.warn("Background workout notification failed", { error: String(err) });
      }
    }

    // Water goal
    if (after.waterCompleted && !before?.waterCompleted && !notificationStore.hasNotifiedWaterGoal(today)) {
      notificationStore.markWaterGoalNotified(today);
      await NotificationService.notifyWaterGoalReached(after.waterLiters ?? 0);
    }

    // Sleep goal
    if (after.sleepCompleted && !before?.sleepCompleted && !notificationStore.hasNotifiedSleepGoal(today)) {
      notificationStore.markSleepGoalNotified(today);
      await NotificationService.notifySleepGoalReached(after.sleepMinutes ?? 0);
    }

    // Weight logged
    if (after.weightLogged && !before?.weightLogged && !notificationStore.hasNotifiedWeightLogged(today)) {
      notificationStore.markWeightLoggedNotified(today);
      await NotificationService.notifyWeightLogged(after.currentWeight ?? 0);
    }

    // Steps: full goal reached, or a discrete "remaining" milestone
    if (challenge.trackSteps && after.stepsCount) {
      const goal = challenge.stepsGoal || 10000;
      if (after.stepsCompleted && !before?.stepsCompleted) {
        if (!notificationStore.hasNotifiedStepGoal(today)) {
          notificationStore.markStepGoalNotified(today);
          await NotificationService.notifyStepGoalReached(after.stepsCount, goal);
        }
      } else {
        const remaining = Math.max(0, goal - after.stepsCount);
        const bucket = Math.floor(remaining / STEPS_MILESTONE_INTERVAL) * STEPS_MILESTONE_INTERVAL;
        if (bucket > 0 && bucket < goal && !notificationStore.hasNotifiedStepsMilestone(today, bucket)) {
          notificationStore.markStepsMilestoneNotified(today, bucket);
          await NotificationService.notifyStepsMilestone(bucket);
        }
      }
    }

    // Day complete — shares the same dedup the in-app toggle path uses, so
    // whichever path detects it first "wins" and the other stays quiet.
    if (
      isDayComplete(challenge, after, challengeState.allLogs) &&
      !notificationStore.hasNotifiedDayComplete(today)
    ) {
      notificationStore.markDayCompleteNotified(today);
      await NotificationService.notifyDayComplete();
    }
  } catch (err) {
    captureException(err instanceof Error ? err : new Error("resyncTodayAndNotify failed"));
  }
}
