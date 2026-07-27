const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function exchangeAuthorizationCode(code: string): Promise<StravaTokenResponse> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
  });

  return postToStrava(params);
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return postToStrava(params);
}

async function postToStrava(params: URLSearchParams): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const body = await response.json();

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Strava token request failed";
    throw new Error(message);
  }

  return body as StravaTokenResponse;
}
