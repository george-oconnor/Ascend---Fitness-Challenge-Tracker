const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

export async function sendExpoPush(pushToken: string, data: Record<string, unknown>): Promise<void> {
  const response = await fetch(EXPO_PUSH_API, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: pushToken,
      sound: null,
      priority: "high",
      contentAvailable: true,
      data,
    }),
  });

  if (!response.ok) {
    throw new Error(`Expo push send failed: ${response.status} ${await response.text()}`);
  }
}
