import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUBSCRIPTIONS_URL = "https://www.strava.com/api/v3/push_subscriptions";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// One-time admin operation: create/list Strava's (single, app-wide) webhook
// subscription. Guarded by the same verify token used in the webhook
// handshake itself, so this isn't just an open endpoint — pass it as
// ?token=<STRAVA_WEBHOOK_VERIFY_TOKEN>.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.query.token;
  if (token !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const clientId = requireEnv("STRAVA_CLIENT_ID");
  const clientSecret = requireEnv("STRAVA_CLIENT_SECRET");

  if (req.method === "GET") {
    const response = await fetch(
      `${SUBSCRIPTIONS_URL}?client_id=${clientId}&client_secret=${clientSecret}`
    );
    res.status(response.status).json(await response.json());
    return;
  }

  if (req.method === "POST") {
    const callbackUrl = typeof req.query.callback_url === "string" ? req.query.callback_url : "";
    if (!callbackUrl) {
      res.status(400).json({ error: "Missing 'callback_url' query param" });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: requireEnv("STRAVA_WEBHOOK_VERIFY_TOKEN"),
    });

    const response = await fetch(SUBSCRIPTIONS_URL, { method: "POST", body: params });
    res.status(response.status).json(await response.json());
    return;
  }

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id : "";
    if (!id) {
      res.status(400).json({ error: "Missing 'id' query param" });
      return;
    }
    const response = await fetch(`${SUBSCRIPTIONS_URL}/${id}?client_id=${clientId}&client_secret=${clientSecret}`, {
      method: "DELETE",
    });
    res.status(response.status).end();
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
