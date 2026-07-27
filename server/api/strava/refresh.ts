import type { VercelRequest, VercelResponse } from "@vercel/node";
import { refreshAccessToken } from "../../lib/strava";

// Exchanges a Strava refresh_token for a new access/refresh token pair.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { refresh_token } = req.body ?? {};
  if (typeof refresh_token !== "string" || !refresh_token) {
    res.status(400).json({ error: "Missing 'refresh_token' in request body" });
    return;
  }

  try {
    const tokens = await refreshAccessToken(refresh_token);
    res.status(200).json(tokens);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Token refresh failed" });
  }
}
