/**
 * One-time Appwrite -> CloudKit data migration for existing users.
 *
 * Runs entirely on the client: sign into the legacy Appwrite account once,
 * read every collection, and write it into the user's CloudKit private zone.
 * This is the ONLY place Appwrite is used after the CloudKit cutover;
 * everything else in the app goes through lib/cloudkit.ts.
 *
 * Idempotent: every CloudKit record is written with a recordName derived from
 * its Appwrite $id (challenges, activity logs, badges) or a deterministic key
 * already used by the live app (daily logs, cycle logs) with an upsert save
 * policy, so re-running after a failure overwrites rather than duplicates.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as appwrite from './appwrite';
import * as ck from './cloudkit';
import { captureException, logger } from './sentry';

const MIGRATION_FLAG = 'migration_state_v1';

export type StepKey =
  | 'signin'
  | 'profile'
  | 'challenges'
  | 'dailyLogs'
  | 'cycleLogs'
  | 'activityLogs'
  | 'badges'
  | 'finalize';

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export type MigrationStep = {
  key: StepKey;
  label: string;
  status: StepStatus;
  count?: number;
};

export type LegacyCredentials = { email: string; password: string };

const STEP_LABELS: Record<StepKey, string> = {
  signin: 'Sign in to your old account',
  profile: 'Profile',
  challenges: 'Challenges',
  dailyLogs: 'Daily logs',
  cycleLogs: 'Cycle tracking',
  activityLogs: 'Activity history',
  badges: 'Badges',
  finalize: 'Finishing up',
};

const STEP_ORDER: StepKey[] = [
  'signin', 'profile', 'challenges', 'dailyLogs', 'cycleLogs', 'activityLogs', 'badges', 'finalize',
];

export function buildSteps(): MigrationStep[] {
  return STEP_ORDER.map((key) => ({ key, label: STEP_LABELS[key], status: 'pending' as StepStatus }));
}

// ── Status detection ──

export async function isMigrationDoneLocally(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_FLAG)) === 'done';
  } catch {
    return false;
  }
}

async function markMigrationDoneLocally(): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_FLAG, 'done');
}

/** Clear the local "migration done" flag (e.g. after account deletion). */
export async function resetMigrationFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_FLAG);
  } catch {
    // best effort
  }
}

/**
 * Whether this CloudKit account already has data (a completed migration record
 * or a challenge) — used to decide whether to offer the migration prompt to a
 * fresh Sign-in-with-Apple user.
 */
export async function cloudKitHasData(): Promise<boolean> {
  try {
    if (await ck.getMigrationState()) return true;
  } catch {
    // ignore
  }
  try {
    const challenge = await ck.getChallenge('me');
    return challenge != null;
  } catch {
    return false;
  }
}

// ── The migration itself ──

export type MigrationResult = { success: boolean; error?: string; counts: Record<string, number> };

export async function runMigration(
  creds: LegacyCredentials | null,
  onProgress: (steps: MigrationStep[]) => void
): Promise<MigrationResult> {
  const steps = buildSteps();
  const counts: Record<string, number> = {};
  const emit = () => onProgress(steps.map((s) => ({ ...s })));
  const setStep = (key: StepKey, status: StepStatus, count?: number) => {
    const step = steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      if (count !== undefined) step.count = count;
    }
    emit();
  };

  logger.info('Migration started');

  try {
    // 1. Legacy sign-in (reuse an existing Appwrite session if still valid)
    setStep('signin', 'active');
    let session = await appwrite.getCurrentSession().catch(() => null);
    if (!session) {
      if (!creds) throw new Error('Please sign in to your old account to migrate.');
      await appwrite.signIn(creds.email, creds.password);
      session = await appwrite.getCurrentSession().catch(() => null);
    }
    const user = await appwrite.getCurrentUser();
    if (!user) throw new Error('Could not load your old account.');
    const userId = user.$id;
    setStep('signin', 'done');

    // 2. Profile
    setStep('profile', 'active');
    const profile = await appwrite.getUserProfile(userId);
    if (profile) {
      await ck.createUserProfile(userId, profile.email || '', profile.firstName || '', profile.lastName || '');
      counts.profile = 1;
    }
    setStep('profile', 'done', counts.profile ?? 0);

    // 3. Challenges — capture old->new id map so daily/activity logs can remap challengeId
    setStep('challenges', 'active');
    const challenges = await appwrite.getAllChallengesForUser(userId);
    const challengeIdMap = new Map<string, string>();
    for (const challenge of challenges) {
      const { $id, ...rest } = challenge;
      if (!$id) continue;
      const newId = await ck.migrateChallenge($id, rest);
      challengeIdMap.set($id, newId);
    }
    counts.challenges = challenges.length;
    setStep('challenges', 'done', challenges.length);
    const remapChallenge = (oldId: string) => challengeIdMap.get(oldId) ?? oldId;

    // 4. Daily logs — deterministic recordName (challengeId+date) makes this a
    // plain idempotent upsert once challengeId is remapped.
    setStep('dailyLogs', 'active');
    const dailyLogs = await appwrite.getAllDailyLogsForUser(userId);
    let migratedDailyLogs = 0;
    for (const log of dailyLogs) {
      const { $id, ...rest } = log;
      await ck.createDailyLog({ ...rest, challengeId: remapChallenge(log.challengeId) }, userId);
      migratedDailyLogs++;
      setStep('dailyLogs', 'active', migratedDailyLogs);
    }
    counts.dailyLogs = migratedDailyLogs;
    setStep('dailyLogs', 'done', migratedDailyLogs);

    // 5. Cycle logs — deterministic recordName (date), also a plain upsert.
    setStep('cycleLogs', 'active');
    const cycleLogs = await appwrite.getAllCycleLogsForUser(userId);
    let migratedCycleLogs = 0;
    for (const log of cycleLogs) {
      const { $id, ...rest } = log;
      await ck.createCycleLog(rest);
      migratedCycleLogs++;
      setStep('cycleLogs', 'active', migratedCycleLogs);
    }
    counts.cycleLogs = migratedCycleLogs;
    setStep('cycleLogs', 'done', migratedCycleLogs);

    // 6. Activity logs — opaque ids, so use the Appwrite $id as the CloudKit
    // recordName basis (migrateActivityLog) to keep re-runs idempotent.
    setStep('activityLogs', 'active');
    const activityLogs = await appwrite.getAllActivityLogsForUser(userId);
    let migratedActivityLogs = 0;
    for (const log of activityLogs) {
      const { $id, ...rest } = log;
      if (!$id) continue;
      await ck.migrateActivityLog($id, { ...rest, challengeId: remapChallenge(log.challengeId) });
      migratedActivityLogs++;
      setStep('activityLogs', 'active', migratedActivityLogs);
    }
    counts.activityLogs = migratedActivityLogs;
    setStep('activityLogs', 'done', migratedActivityLogs);

    // 7. Badges — deterministic recordName (badgeId), preserving original earn date.
    setStep('badges', 'active');
    const badges = await appwrite.getUserBadges(userId);
    for (const badge of badges) {
      await ck.migrateUserBadge(badge.badgeId, {
        userId,
        challengeId: badge.challengeId ? remapChallenge(badge.challengeId) : undefined,
        $createdAt: badge.$createdAt,
      });
    }
    counts.badges = badges.length;
    setStep('badges', 'done', badges.length);

    // 8. Finalize
    setStep('finalize', 'active');
    await ck.setMigrationState(userId, counts);
    await markMigrationDoneLocally();
    setStep('finalize', 'done');

    logger.info('Migration completed', counts);
    return { success: true, counts };
  } catch (err) {
    const errorMsg = describeMigrationError(err);
    const activeStep = steps.find((s) => s.status === 'active');
    if (activeStep) {
      activeStep.status = 'error';
      emit();
    }
    captureException(err instanceof Error ? err : new Error(errorMsg), {
      operation: 'migration',
    });
    return { success: false, error: errorMsg, counts };
  }
}

/**
 * A message for the migration screen. Appwrite's own messages are written for
 * the project's developer (e.g. "Project is paused due to inactivity. Please
 * restore it from the console"), so the server-side ones are replaced.
 */
function describeMigrationError(err: unknown): string {
  if (!(err instanceof Error)) return 'Migration failed';
  const type = (err as { type?: unknown }).type;
  const code = (err as { code?: unknown }).code;
  if (type === 'project_paused' || /project is paused/i.test(err.message)) {
    return "Your old account's server is offline right now, so your data can't be copied yet. Please try again later.";
  }
  if (typeof code === 'number' && code >= 500) {
    return "Your old account's server isn't responding. Please try again later.";
  }
  return err.message;
}

/**
 * Mark migration complete without importing anything — for users who confirm
 * they never used the old app, so they aren't prompted again.
 */
export async function skipMigration(): Promise<void> {
  await markMigrationDoneLocally();
  try {
    await ck.setMigrationState('skipped', {});
  } catch {
    // local flag is enough
  }
}
