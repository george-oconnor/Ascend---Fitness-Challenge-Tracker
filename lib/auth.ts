/**
 * Sign in with Apple + iCloud account gating for the CloudKit backend.
 *
 * The Apple identifier is a stable per-user id we persist in the secure store;
 * it's the app's notion of "who is signed in". The actual data lives in the
 * user's private iCloud database, which requires the device to be signed
 * into iCloud — a separate condition checked with getCloudKitAccountStatus.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  createUserProfile,
  ensureUserZone,
  getCloudKitAccountStatus,
  getCloudKitUserRecordName,
  getUserProfile,
} from './cloudkit';
import { deleteSecureItem, getSecureItem, migrateSecureItems, setSecureItem } from './secureStorage';

const SIWA_USER_KEY = 'siwa_user_id';
const SIWA_EMAIL_KEY = 'siwa_email';
const SIWA_NAME_KEY = 'siwa_name';

export type AppleIdentity = {
  appleUserId: string;
  email?: string;
  fullName?: string;
};

export type ICloudStatus = 'available' | 'unavailable';

export async function isAppleAuthAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Thrown-cancel detection so the UI can stay silent when the user backs out. */
export function isAppleCancel(err: unknown): boolean {
  return (err as any)?.code === 'ERR_REQUEST_CANCELED';
}

/**
 * Apple's own generic wording for ASAuthorizationError.unknown (code 1000) —
 * a native-side failure (stale iCloud session, Apple auth-server hiccup,
 * missing entitlement) that the app can't diagnose or retry around, so the UI
 * should show something more actionable than the raw message.
 */
export function isAppleUnknownError(err: unknown): boolean {
  return (err as any)?.code === 'ERR_REQUEST_UNKNOWN';
}

/**
 * Runs the Apple sign-in sheet. Apple only returns name/email on the FIRST
 * authorization for a given Apple ID, so we persist them immediately and fall
 * back to the stored copy on subsequent sign-ins.
 */
export async function signInWithApple(): Promise<AppleIdentity> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const appleUserId = credential.user;
  const nameFromCredential = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ').trim()
    : '';

  const email = credential.email ?? (await getSecureItem(SIWA_EMAIL_KEY)) ?? undefined;
  const fullName = nameFromCredential || (await getSecureItem(SIWA_NAME_KEY)) || undefined;

  await setSecureItem(SIWA_USER_KEY, appleUserId);
  if (email) await setSecureItem(SIWA_EMAIL_KEY, email);
  if (fullName) await setSecureItem(SIWA_NAME_KEY, fullName);

  return { appleUserId, email, fullName };
}

export async function getStoredIdentity(): Promise<AppleIdentity | null> {
  // Older versions stored these readable only while unlocked; move them to
  // after-first-unlock so background launches can read them (foreground only).
  await migrateSecureItems();
  const appleUserId = await getSecureItem(SIWA_USER_KEY);
  if (!appleUserId) return null;
  const email = (await getSecureItem(SIWA_EMAIL_KEY)) ?? undefined;
  const fullName = (await getSecureItem(SIWA_NAME_KEY)) ?? undefined;
  return { appleUserId, email, fullName };
}

export async function clearStoredIdentity(): Promise<void> {
  await deleteSecureItem(SIWA_USER_KEY);
  await deleteSecureItem(SIWA_EMAIL_KEY);
  await deleteSecureItem(SIWA_NAME_KEY);
}

/** AUTHORIZED means the Apple ID still trusts this app. REVOKED/NOT_FOUND require re-auth. */
export async function isAppleCredentialValid(appleUserId: string): Promise<boolean> {
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(appleUserId);
    return state === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED;
  } catch {
    // getCredentialStateAsync is unreliable in the simulator; don't hard-fail there
    return true;
  }
}

export async function checkICloud(): Promise<ICloudStatus> {
  try {
    const status = await getCloudKitAccountStatus();
    return status === 'available' ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Provision the CloudKit zone, resolve the iCloud user record id, and make sure
 * a UserProfile record exists. Call after a successful sign-in with iCloud
 * available. Returns the CloudKit user record name (used as the session token).
 */
export async function activateCloudKitSession(
  identity: AppleIdentity
): Promise<{ userRecordName: string; name?: string; email?: string }> {
  await ensureUserZone();
  const userRecordName = await getCloudKitUserRecordName();

  let existing = await getUserProfile(identity.appleUserId).catch(() => null);
  if (!existing) {
    const [firstName, ...rest] = (identity.fullName ?? '').split(' ');
    await createUserProfile(
      identity.appleUserId,
      identity.email ?? '',
      firstName ?? '',
      rest.join(' ')
    ).catch((err) => console.warn('Failed to create user profile:', err));
    existing = await getUserProfile(identity.appleUserId).catch(() => null);
  }

  // Apple only returns the name on first authorization; fall back to the
  // CloudKit profile (e.g. migrated from Appwrite) so the UI still has a name.
  const profileName = existing
    ? `${(existing as any).firstName ?? ''} ${(existing as any).lastName ?? ''}`.trim()
    : '';
  const profileEmail = existing ? (existing as any).email : undefined;

  return {
    userRecordName,
    name: identity.fullName || profileName || undefined,
    email: identity.email || profileEmail || undefined,
  };
}
