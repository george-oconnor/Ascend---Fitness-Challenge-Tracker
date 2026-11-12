/**
 * Keychain access that works in background launches.
 *
 * expo-secure-store's default accessibility is "when unlocked", so any read
 * while the phone is locked (HealthKit background delivery, a Strava silent
 * push) fails with "User interaction is not allowed" (Sentry ASCEND-APP-1R).
 * Items written here use AFTER_FIRST_UNLOCK instead: readable while locked,
 * as long as the phone has been unlocked once since it started.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const MIGRATED_PREFIX = 'secureStore.afterFirstUnlock.';

/** Every keychain item the app stores: Sign in with Apple (lib/auth.ts) and Strava (lib/strava.ts). */
const ALL_KEYS = [
  'siwa_user_id',
  'siwa_email',
  'siwa_name',
  'strava_access_token',
  'strava_refresh_token',
  'strava_expires_at',
  'strava_athlete_id',
];

// While a migration rewrites an item it briefly doesn't exist, so reads and
// writes wait for it to finish.
let migration: Promise<void> | null = null;

const isInteractionError = (err: unknown) => String(err).includes('User interaction is not allowed');

/**
 * Reads a keychain item. At cold launch reads can briefly fail with
 * errSecInteractionNotAllowed even when the phone is unlocked, so this backs
 * off with growing delays (about 5 seconds in total) before giving up.
 */
export async function getSecureItem(key: string, attempts = 7, baseDelayMs = 150): Promise<string | null> {
  if (migration) await migration;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await SecureStore.getItemAsync(key, OPTIONS);
    } catch (err) {
      if (!isInteractionError(err) || attempt === attempts) throw err;
      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), 1500);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Writes a keychain item readable after first unlock. The item is deleted
 * first because expo-secure-store only updates the value of an existing item
 * and would keep its old (when-unlocked) accessibility.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (migration) await migration;
  await writeAfterFirstUnlock(key, value);
}

async function writeAfterFirstUnlock(key: string, value: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, OPTIONS);
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (migration) await migration;
  await SecureStore.deleteItemAsync(key, OPTIONS);
}

/**
 * Rewrites items saved by older versions (when-unlocked) so background
 * launches can read them. Runs only while the app is in the foreground, where
 * the keychain is readable, and only once per key. Call at startup.
 */
export function migrateSecureItems(): Promise<void> {
  if (AppState.currentState !== 'active') return Promise.resolve();
  if (!migration) {
    migration = (async () => {
      for (const key of ALL_KEYS) {
        try {
          const flag = MIGRATED_PREFIX + key;
          if (await AsyncStorage.getItem(flag)) continue;
          const value = await SecureStore.getItemAsync(key, OPTIONS);
          if (value !== null) await writeAfterFirstUnlock(key, value);
          await AsyncStorage.setItem(flag, '1');
        } catch {
          // Try again on a later launch.
        }
      }
    })().finally(() => {
      migration = null;
    });
  }
  return migration;
}
