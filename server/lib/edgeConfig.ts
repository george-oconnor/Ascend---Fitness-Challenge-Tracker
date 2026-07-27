// Small routing table: Strava athlete_id -> Expo push token.
// Reads go through Vercel's Edge Config read API (fast, eventually-consistent).
// Writes go through Vercel's regular REST API, since Edge Config's read SDK is read-only.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

type PushTokenMap = Record<string, string>;

const ITEM_KEY = "athletePushTokens";

export async function getPushToken(athleteId: string): Promise<string | null> {
  const map = await readMap();
  return map[athleteId] ?? null;
}

export async function setPushToken(athleteId: string, pushToken: string): Promise<void> {
  const map = await readMap();
  map[athleteId] = pushToken;
  await writeMap(map);
}

async function readMap(): Promise<PushTokenMap> {
  // EDGE_CONFIG is the standard connection string: https://edge-config.vercel.com/<id>?token=<read-token>
  const connectionUrl = new URL(requireEnv("EDGE_CONFIG"));
  const readToken = connectionUrl.searchParams.get("token");
  const itemUrl = `${connectionUrl.origin}${connectionUrl.pathname}/item/${ITEM_KEY}?token=${readToken}`;

  const response = await fetch(itemUrl);
  if (response.status === 404) return {};
  if (!response.ok) {
    throw new Error(`Edge Config read failed: ${response.status} ${await response.text()}`);
  }
  const value = await response.json();
  return (value as PushTokenMap) ?? {};
}

async function writeMap(map: PushTokenMap): Promise<void> {
  const edgeConfigId = requireEnv("EDGE_CONFIG_ID");
  const apiToken = requireEnv("VERCEL_API_TOKEN");

  const response = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: ITEM_KEY, value: map }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Edge Config write failed: ${response.status} ${await response.text()}`);
  }
}
