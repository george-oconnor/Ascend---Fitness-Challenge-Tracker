import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setPushToken } from "../lib/edgeConfig";

const STRAVA_ATHLETE_URL = "https://www.strava.com/api/v3/athlete";

// Registers this device's push token against the caller's Strava athlete id,
// so the webhook handler knows where to route events for that athlete.
// The athlete id is derived server-side from the caller's own Strava access
// token (never trusted from the request body) so one client can't register
// push tokens against another athlete's id.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { accessToken, pushToken } = req.body ?? {};
  if (typeof accessToken !== "string" || !accessToken) {
    res.status(400).json({ error: "Missing 'accessToken' in request body" });
    return;
  }
  if (typeof pushToken !== "string" || !pushToken) {
    res.status(400).json({ error: "Missing 'pushToken' in request body" });
    return;
  }

  try {
    const athleteResponse = await fetch(STRAVA_ATHLETE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!athleteResponse.ok) {
      res.status(401).json({ error: "Invalid Strava access token" });
      return;
    }
    const athlete = await athleteResponse.json();

    await setPushToken(String(athlete.id), pushToken);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to register push token" });
  }
}
