import { healthService, type WorkoutData } from "@/lib/health";

/**
 * A workout from either HealthKit or a direct Strava sync, normalized to a
 * common shape so both sources can go through the same chronological
 * workout1/workout2 slot assignment. A workout must appear exactly once in
 * the merged list — see getMergedWorkoutsForDate for how the two sources are
 * de-duplicated.
 */
export type MergedWorkout = {
  /** Stable per-workout key for lists: the HealthKit sample id, or "strava-<activityId>". */
  id: string;
  typeId: string; // matches an id in app/log-workout.tsx's WORKOUT_TYPES
  activityName: string;
  duration: number; // minutes
  calories?: number;
  distance?: number; // meters
  isOutdoor: boolean;
  startDate: string;
  endDate: string;
  source: "healthkit" | "strava";
  externalId?: string;
};

export type MergedWorkoutOptions = {
  log?: (message: string) => void;
  /**
   * Skip the cache below and hit Strava's API. Pass this for anything the user
   * or Strava itself triggered — a refresh tap, "Sync Now", a webhook push —
   * where the whole point is to see a change that just happened. Leave it off
   * for automatic background resyncs.
   */
  forceStravaFetch?: boolean;
};

// Strava's API is rate limited (per-15-minutes and per-day), and automatic
// resyncs can fire many times an hour — every step-count change on the home
// screen triggers one. Caching the day's activity list briefly keeps that
// traffic bounded; anything the user actually initiated bypasses it.
const STRAVA_CACHE_TTL_MS = 5 * 60 * 1000;

let stravaCache: { dayKey: string; fetchedAt: number; workouts: MergedWorkout[] } | null = null;

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

function readStravaCache(dayKey: string, forceStravaFetch: boolean): MergedWorkout[] | null {
  if (forceStravaFetch || !stravaCache) return null;
  if (stravaCache.dayKey !== dayKey) return null;
  if (Date.now() - stravaCache.fetchedAt > STRAVA_CACHE_TTL_MS) return null;
  return stravaCache.workouts;
}

/** Drops the cached Strava activity list — call when the Strava connection changes. */
export function clearStravaWorkoutCache(): void {
  stravaCache = null;
}

/**
 * The single source of truth for "which workouts happened on this date" —
 * HealthKit's samples plus a live Strava fetch, de-duplicated and sorted
 * chronologically. Used both to reconcile the daily log's workout slots and
 * to render the daily log's workout list, so the two can't disagree.
 *
 * De-duplication: when the live Strava list is available, HealthKit samples
 * that Strava itself wrote are dropped in favor of it — that's the list that
 * reflects deletions, since Strava's own Health sync leaves the HealthKit
 * copy behind when an activity is deleted. If Strava isn't connected, or the
 * fetch fails, those HealthKit samples are kept instead: they're stale-prone
 * but far better than silently dropping the day's workouts.
 *
 * Samples this app wrote back to HealthKit itself (source "Ascend", see the
 * opt-in Strava -> Apple Health sync) are always dropped — they're a mirror
 * of a Strava activity, never a primary record.
 */
export async function getMergedWorkoutsForDate(
  date: Date,
  { log = () => {}, forceStravaFetch = false }: MergedWorkoutOptions = {}
): Promise<MergedWorkout[]> {
  const healthWorkouts = await healthService.getWorkoutsForDate(date);

  let stravaWorkouts: MergedWorkout[] | null = null;
  try {
    const { isStravaConnected, getActivities, mapStravaActivity } = await import("@/lib/strava");
    if (await isStravaConnected()) {
      const dayKey = dateKey(date);
      const cached = readStravaCache(dayKey, forceStravaFetch);

      if (cached) {
        stravaWorkouts = cached;
        log(`🟠 Using ${cached.length} cached Strava activity(ies)`);
      } else {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const stravaActivities = await getActivities(dayStart, dayEnd);
        stravaWorkouts = stravaActivities.map(mapStravaActivity).map((w) => ({
          id: `strava-${w.externalId}`,
          typeId: w.workoutTypeId,
          activityName: w.activityName,
          duration: w.duration,
          calories: w.calories,
          distance: w.distance,
          isOutdoor: w.isOutdoor,
          startDate: w.startDate,
          endDate: w.endDate,
          source: "strava" as const,
          externalId: w.externalId,
        }));
        stravaCache = { dayKey, fetchedAt: Date.now(), workouts: stravaWorkouts };
        log(`🟠 Found ${stravaWorkouts.length} Strava activity(ies)`);
      }
    }
  } catch (stravaErr) {
    log(`⚠️ Strava sync skipped: ${stravaErr instanceof Error ? stravaErr.message : "Unknown error"}`);
  }

  const healthKitWorkouts: MergedWorkout[] = healthWorkouts
    .filter((w: WorkoutData) => {
      if (w.sourceName === "Ascend") return false;
      return !(stravaWorkouts !== null && w.sourceName === "Strava");
    })
    .map((w: WorkoutData) => ({
      id: w.id,
      typeId: w.activityName.toLowerCase().replace(/\s+/g, "-"),
      activityName: w.activityName,
      duration: w.duration,
      calories: w.calories,
      distance: w.distance,
      isOutdoor: w.isOutdoor,
      startDate: w.startDate,
      endDate: w.endDate,
      source: "healthkit" as const,
    }));

  const merged = [...healthKitWorkouts, ...(stravaWorkouts ?? [])];
  merged.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  log(`🏋️ Found ${merged.length} workout(s)`);
  merged.forEach((w, idx) => {
    log(`  ${idx + 1}. ${w.activityName} (${w.source}): ${w.duration} min, ${w.isOutdoor ? "outdoor" : "indoor"}`);
  });

  return merged;
}
