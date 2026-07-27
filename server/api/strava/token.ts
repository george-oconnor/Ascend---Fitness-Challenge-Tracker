import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeAuthorizationCode } from "../../lib/strava";

// Exchanges a Strava OAuth `code` for an access/refresh token pair.
// This is the only place the app's Strava client_secret is used —
// the mobile client never sees it.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code } = req.body ?? {};
  if (typeof code !== "string" || !code) {
    res.status(400).json({ error: "Missing 'code' in request body" });
    return;
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    res.status(200).json(tokens);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Token exchange failed" });
  }
}
