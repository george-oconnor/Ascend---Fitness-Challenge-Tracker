import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

export const BACKGROUND_NOTIFICATION_TASK = "background-notification-task";

// Must be defined at module scope (not inside a component/effect) so iOS can
// find and invoke it when it launches the app headlessly for a silent push —
// including from a killed state, before any of the app's own React code has
// run. This is what actually lets the Strava webhook's silent push
// (server/api/strava/webhook.ts) resync and notify while the app is closed;
// the `Notifications.addNotificationReceivedListener` in app/_layout.tsx only
// fires while the JS runtime is already running (foreground/recently
// backgrounded), so it can't wake the app on its own.
//
// This app only ever sends one kind of silent push, so any wake-up here
// means "go resync" — no need to inspect the payload.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ error }) => {
  if (error) {
    console.error("Background notification task error:", error);
    return;
  }

  const { resyncTodayAndNotify } = await import("@/lib/resyncAndNotify");
  await resyncTodayAndNotify();
});

let registered = false;

export async function registerBackgroundNotificationTask(): Promise<void> {
  if (registered) return;
  registered = true;
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    console.error("Failed to register background notification task:", err);
  }
}
