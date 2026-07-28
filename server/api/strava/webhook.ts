import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPushToken } from "../../lib/edgeConfig";
import { sendExpoPush } from "../../lib/expoPush";

type StravaWebhookEvent = {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // One-time subscription verification handshake.
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).json({ "hub.challenge": challenge });
      return;
    }
    res.status(403).json({ error: "Verification failed" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const event = req.body as StravaWebhookEvent;

  // Deletes matter as much as creates: the app's resync recomputes the day
  // from Strava's current activity list, so a deleted activity has to wake it
  // to drop back out of the daily log.
  if (event?.object_type !== "activity") {
    res.status(200).json({ ok: true });
    return;
  }

  // Do the work before responding — Vercel's Node runtime can freeze the
  // function immediately after a response is sent, so anything "fire and
  // forget" after res.json() isn't guaranteed to finish.
  try {
    const pushToken = await getPushToken(String(event.owner_id));
    if (pushToken) {
      await sendExpoPush(pushToken, {
        type: "strava-activity",
        activityId: event.object_id,
        aspectType: event.aspect_type,
      });
    }
  } catch (err) {
    console.error("Failed to relay Strava webhook event:", err);
  }

  res.status(200).json({ ok: true });
}
