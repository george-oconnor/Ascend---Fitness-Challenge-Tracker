/**
 * What version of Ascend is running, shown at the bottom of Settings so the user
 * can tell whether they have the latest update.
 *
 * - App version and build: the installed binary (App Store / TestFlight build).
 * - Update number: the run number of the "Mobile OTA update" workflow that
 *   published the JavaScript bundle, baked in at publish time as
 *   EXPO_PUBLIC_UPDATE_NUMBER (with the commit as EXPO_PUBLIC_GIT_SHA). It
 *   goes up by one with every published update, and promoting an update to
 *   the App Store channel keeps the same number. A build that hasn't
 *   downloaded an update yet runs its built-in bundle.
 */
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

export interface AppVersionInfo {
  appVersion: string; // e.g. "1.1.0"
  build: string; // e.g. "21"
  updateNumber: string | null; // e.g. "12"; null for a bundle not published by the workflow
  commit: string | null; // short git sha
  isBuiltIn: boolean; // running the bundle that shipped with the build
  channel: string | null;
  publishedAt: Date | null;
}

export function getAppVersion(): AppVersionInfo {
  const sha = process.env.EXPO_PUBLIC_GIT_SHA;
  return {
    appVersion: Application.nativeApplicationVersion ?? '?',
    build: Application.nativeBuildVersion ?? '?',
    updateNumber: process.env.EXPO_PUBLIC_UPDATE_NUMBER || null,
    commit: sha ? sha.slice(0, 7) : null,
    isBuiltIn: Updates.isEmbeddedLaunch,
    channel: Updates.channel ?? null,
    publishedAt: Updates.isEmbeddedLaunch ? null : Updates.createdAt ?? null,
  };
}

/** One line, e.g. "Ascend 2.1.1 (3) · update 12 · 4670153". */
export function formatAppVersion(v: AppVersionInfo = getAppVersion()): string {
  const parts = [`Ascend ${v.appVersion} (${v.build})`];
  if (v.updateNumber) parts.push(`update ${v.updateNumber}`);
  else if (v.isBuiltIn) parts.push('built-in');
  if (v.commit) parts.push(v.commit);
  return parts.join(' · ');
}
