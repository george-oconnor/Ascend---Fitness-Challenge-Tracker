import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { getExpoPushTokenAsync } from "./notifications";
import { logger } from "./sentry";

WebBrowser.maybeCompleteAuthSession();

// Token-exchange proxy — the only server component this app has. It holds the
// Strava client_secret so it never ships inside the app binary. See /server.
const TOKEN_SERVER_URL = process.env.EXPO_PUBLIC_STRAVA_TOKEN_SERVER_URL ?? "";
const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? "";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/mobile/authorize";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

const ACCESS_TOKEN_KEY = "strava_access_token";
const REFRESH_TOKEN_KEY = "strava_refresh_token";
const EXPIRES_AT_KEY = "strava_expires_at";
const ATHLETE_ID_KEY = "strava_athlete_id";

// Refresh a bit before actual expiry to avoid a request racing an expired token.
const REFRESH_MARGIN_SECONDS = 5 * 60;

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  calories?: number;
};

/**
 * Normalized shape used by the app's workout-slot reconciliation logic
 * (mirrors WorkoutData in lib/health.ts so both sources can share the same
 * "sort by start time, assign to workout1/workout2" logic).
 */
export type StravaWorkout = {
  externalId: string;
  workoutTypeId: string; // matches an id in app/log-workout.tsx's WORKOUT_TYPES
  activityName: string;
  duration: number; // minutes
  calories?: number;
  distance?: number; // meters, matches WorkoutData.distance in lib/health.ts
  isOutdoor: boolean;
  startDate: string;
  endDate: string;
};

// Strava's sport_type -> this app's WORKOUT_TYPES id (see app/log-workout.tsx).
// Unrecognized sport types fall back to "other" rather than being dropped.
const STRAVA_TYPE_MAP: Record<string, { id: string; label: string; isOutdoor: boolean }> = {
  Run: { id: "running", label: "Running", isOutdoor: true },
  TrailRun: { id: "running", label: "Running", isOutdoor: true },
  VirtualRun: { id: "running", label: "Running", isOutdoor: false },
  Walk: { id: "walking", label: "Walking", isOutdoor: true },
  Hike: { id: "hiking", label: "Hiking", isOutdoor: true },
  Ride: { id: "cycling", label: "Cycling", isOutdoor: true },
  MountainBikeRide: { id: "cycling", label: "Cycling", isOutdoor: true },
  GravelRide: { id: "cycling", label: "Cycling", isOutdoor: true },
  EBikeRide: { id: "cycling", label: "Cycling", isOutdoor: true },
  VirtualRide: { id: "cycling", label: "Cycling", isOutdoor: false },
  Swim: { id: "swimming", label: "Swimming", isOutdoor: false },
  Rowing: { id: "rowing", label: "Rowing", isOutdoor: true },
  VirtualRow: { id: "indoor-rowing", label: "Indoor Rowing", isOutdoor: false },
  WeightTraining: { id: "strength", label: "Strength Training", isOutdoor: false },
  HighIntensityIntervalTraining: { id: "hiit", label: "HIIT", isOutdoor: false },
  Yoga: { id: "yoga", label: "Yoga", isOutdoor: false },
  Pilates: { id: "pilates", label: "Pilates", isOutdoor: false },
  Crossfit: { id: "crossfit", label: "CrossFit", isOutdoor: false },
  Boxing: { id: "boxing", label: "Boxing", isOutdoor: false },
  Dance: { id: "dance", label: "Dance", isOutdoor: false },
  Workout: { id: "other", label: "Other", isOutdoor: false },
};

export function mapStravaActivity(activity: StravaActivity): StravaWorkout {
  const mapped = STRAVA_TYPE_MAP[activity.sport_type] ?? STRAVA_TYPE_MAP[activity.type];
  const startDate = new Date(activity.start_date);
  const endDate = new Date(startDate.getTime() + activity.elapsed_time * 1000);

  return {
    externalId: String(activity.id),
    workoutTypeId: mapped?.id ?? "other",
    activityName: mapped?.label ?? activity.sport_type ?? activity.type ?? "Workout",
    duration: Math.round(activity.moving_time / 60),
    calories: activity.calories ? Math.round(activity.calories) : undefined,
    distance: activity.distance || undefined,
    isOutdoor: mapped?.isOutdoor ?? false,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
};

function requireTokenServerUrl(): string {
  if (!TOKEN_SERVER_URL) {
    throw new Error(
      "EXPO_PUBLIC_STRAVA_TOKEN_SERVER_URL is not configured — set it to the deployed /server Vercel URL."
    );
  }
  return TOKEN_SERVER_URL;
}

async function storeTokens(tokens: StravaTokenResponse): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.access_token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
  await SecureStore.setItemAsync(EXPIRES_AT_KEY, String(tokens.expires_at));
  if (tokens.athlete?.id) {
    await SecureStore.setItemAsync(ATHLETE_ID_KEY, String(tokens.athlete.id));
  }
}

export async function isStravaConnected(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null;
}

export async function getStoredAthleteId(): Promise<string | null> {
  return SecureStore.getItemAsync(ATHLETE_ID_KEY);
}

/**
 * Runs the Strava OAuth consent screen and completes the authorization-code
 * exchange via the token server. Returns once tokens are stored.
 */
export async function connectStrava(): Promise<void> {
  if (!STRAVA_CLIENT_ID) {
    throw new Error("EXPO_PUBLIC_STRAVA_CLIENT_ID is not configured.");
  }

  const redirectUri = AuthSession.makeRedirectUri({ path: "strava-callback" });

  const request = new AuthSession.AuthRequest({
    clientId: STRAVA_CLIENT_ID,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["activity:read_all"],
    // Strava's OAuth doesn't support PKCE — it's a confidential-client flow
    // that exchanges the code server-side using the client_secret instead.
    usePKCE: false,
    extraParams: { approval_prompt: "auto" },
  });

  const result = await request.promptAsync({ authorizationEndpoint: STRAVA_AUTHORIZE_URL });

  if (result.type !== "success" || !result.params.code) {
    if (result.type === "cancel" || result.type === "dismiss") {
      throw new StravaAuthCancelledError();
    }
    throw new Error(`Strava authorization failed: ${result.type}`);
  }

  const response = await fetch(`${requireTokenServerUrl()}/api/strava/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: result.params.code }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token exchange failed: ${body}`);
  }

  const tokens: StravaTokenResponse = await response.json();
  await storeTokens(tokens);
  logger.info("Strava connected", { athleteId: tokens.athlete?.id });

  // Best-effort — real-time sync via webhooks is a nice-to-have, not required
  // for the connection itself to succeed.
  registerPushToken(tokens.access_token).catch((err) =>
    logger.warn("Strava push token registration failed", { error: String(err) })
  );
}

async function registerPushToken(accessToken: string): Promise<void> {
  const pushToken = await getExpoPushTokenAsync();
  if (!pushToken) return;

  const response = await fetch(`${requireTokenServerUrl()}/api/push-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, pushToken }),
  });

  if (!response.ok) {
    throw new Error(`Push token registration failed: ${await response.text()}`);
  }
}

export class StravaAuthCancelledError extends Error {
  constructor() {
    super("Strava authorization was cancelled");
    this.name = "StravaAuthCancelledError";
  }
}

export async function disconnectStrava(): Promise<void> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(EXPIRES_AT_KEY),
    SecureStore.deleteItemAsync(ATHLETE_ID_KEY),
  ]);

  if (accessToken) {
    // Best-effort — Strava revokes the specific token used, no need to block on it.
    fetch(`${STRAVA_API_BASE}/oauth/deauthorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((err) => logger.warn("Strava deauthorize failed", { error: String(err) }));
  }
}

/**
 * Returns a valid access token, transparently refreshing via the token server
 * when it's expired or close to it. Returns null if Strava isn't connected.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const expiresAt = Number((await SecureStore.getItemAsync(EXPIRES_AT_KEY)) ?? 0);
  const nowSeconds = Date.now() / 1000;

  if (accessToken && expiresAt - nowSeconds > REFRESH_MARGIN_SECONDS) {
    return accessToken;
  }

  const response = await fetch(`${requireTokenServerUrl()}/api/strava/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token refresh failed: ${body}`);
  }

  const tokens: StravaTokenResponse = await response.json();
  await storeTokens(tokens);
  return tokens.access_token;
}

/** Activities with start_date_local within [after, before), both inclusive-exclusive local days. */
export async function getActivities(after: Date, before: Date): Promise<StravaActivity[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const params = new URLSearchParams({
    after: String(Math.floor(after.getTime() / 1000)),
    before: String(Math.floor(before.getTime() / 1000)),
    per_page: "50",
  });

  const response = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava activities request failed: ${body}`);
  }

  return response.json();
}
