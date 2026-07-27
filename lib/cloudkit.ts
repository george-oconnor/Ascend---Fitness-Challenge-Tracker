/**
 * CloudKit implementation of the backend surface previously provided by
 * lib/appwrite.ts. Function names and signatures mirror the Appwrite versions
 * so call sites (store/useChallengeStore.ts, hooks/useCycleLog.ts, the
 * log-*.tsx screens, profile/analytics/edit-profile) only need their import
 * swapped, not rewritten.
 *
 * Storage model:
 * - All user data lives in the private database, custom zone "UserData".
 *   The private DB is per-user by construction, so `userId` parameters are
 *   accepted (for signature compatibility) but not stored or filtered on
 *   except where a field of that name already existed in the Appwrite schema.
 * - Deterministic recordNames replace query-then-upsert for anything that's
 *   naturally one-per-key: the profile singleton ("profile"), one DailyLog
 *   per challenge+date ("dailylog_<challengeId>_<date>"), one CycleLog per
 *   date ("cyclelog_<date>"), one UserBadge per badge ("badge_<badgeId>").
 *   Challenges and ActivityLogs are append-only / can repeat, so they get
 *   opaque unique IDs (UUIDs) instead.
 * - CloudKit has no server-side "order by creation date" for custom queries
 *   through this bridge, so anything sorted by recency (Challenge, ActivityLog,
 *   UserBadge) carries an explicit `createdAt` field set at write time.
 */
import CloudKitStorage, {
  FieldValue,
  Filter,
  RecordInput,
  RecordOutput,
  SaveResult,
  Sort,
  getRetryAfterSeconds,
} from '../modules/cloudkit-storage';
import type {
  ActivityLog,
  ActivityType,
  Challenge,
  CycleLog,
  DailyLog,
  UserBadge,
  UserProfile,
} from '@/types/type';
import { BadgeId } from '@/types/type';
import { ID } from './ids';
import { captureException } from './sentry';

export const ZONE = 'UserData';

// ============================================================
// Availability / account
// ============================================================

export function isCloudKitAvailable(): boolean {
  return CloudKitStorage != null;
}

function native() {
  if (!CloudKitStorage) {
    throw new Error('CloudKit native module not available (requires a development build, not Expo Go)');
  }
  return CloudKitStorage;
}

let cachedUserRecordName: string | null = null;
export async function getCloudKitUserRecordName(): Promise<string> {
  if (!cachedUserRecordName) {
    cachedUserRecordName = await native().getUserRecordName();
  }
  return cachedUserRecordName;
}

export async function getCloudKitAccountStatus() {
  return native().getAccountStatus();
}

/** Public entry point for the auth flow to provision the user's data zone. */
export async function ensureUserZone(): Promise<void> {
  return ensureZone();
}

let zoneReady: Promise<void> | null = null;
async function ensureZone(): Promise<void> {
  if (!zoneReady) {
    zoneReady = native()
      .ensureZone(ZONE)
      .catch((err) => {
        zoneReady = null; // allow retry on next call
        throw err;
      });
  }
  return zoneReady;
}

// ============================================================
// Error handling / retry
// ============================================================

function errorCode(err: unknown): string {
  return (err as any)?.code || 'CK_ERROR';
}

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries RATE_LIMITED (respecting the server's retryAfter hint) and recovers
 * once from ZONE_NOT_FOUND by recreating the zone. Everything else rethrows.
 */
async function withRetry<T>(op: () => Promise<T>, label: string): Promise<T> {
  let zoneRetried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (err) {
      const code = errorCode(err);
      if (code === 'ZONE_NOT_FOUND' && !zoneRetried) {
        zoneRetried = true;
        zoneReady = null;
        await ensureZone();
        continue;
      }
      if (code === 'RATE_LIMITED' && attempt < 2) {
        const retryAfter = getRetryAfterSeconds(err) ?? 3;
        console.warn(`${label}: CloudKit rate limited, retrying in ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ============================================================
// Record <-> doc coding
// ============================================================

type FieldTypes = Record<string, FieldValue['type']>;

const PROFILE_FIELDS: FieldTypes = {
  authId: 'string',
  email: 'string',
  firstName: 'string',
  lastName: 'string',
  createdAt: 'date',
  lastLoginTime: 'date',
};

const CHALLENGE_FIELDS: FieldTypes = {
  userId: 'string',
  startDate: 'date',
  endDate: 'date',
  totalDays: 'int',
  trackSteps: 'bool',
  stepsGoal: 'int',
  trackWater: 'bool',
  waterLiters: 'double',
  trackDiet: 'bool',
  trackCalories: 'bool',
  caloriesGoal: 'int',
  caloriesGoalDirection: 'string',
  trackWeight: 'bool',
  weightGoal: 'double',
  trackWorkout1: 'bool',
  trackWorkout2: 'bool',
  workoutMinutes: 'int',
  trackReading: 'bool',
  readingPages: 'int',
  trackProgressPhoto: 'bool',
  progressPhotoDays: 'int',
  trackNoAlcohol: 'bool',
  trackMood: 'bool',
  trackSleep: 'bool',
  sleepGoalHours: 'double',
  trackCycle: 'bool',
  averageCycleLength: 'int',
  averagePeriodLength: 'int',
  lastPeriodStart: 'date',
  trackSkincare: 'bool',
  createdAt: 'date',
};

const DAILY_LOG_FIELDS: FieldTypes = {
  userId: 'string',
  challengeId: 'string',
  date: 'date',
  stepsCompleted: 'bool',
  stepsCount: 'int',
  waterCompleted: 'bool',
  waterLiters: 'double',
  dietCompleted: 'bool',
  caloriesConsumed: 'double',
  calorieDetails: 'string',
  currentWeight: 'double',
  weightLogged: 'bool',
  workout1Completed: 'bool',
  workout1Minutes: 'int',
  workout2Completed: 'bool',
  workout2Minutes: 'int',
  workoutDetails: 'string',
  readingCompleted: 'bool',
  readingPages: 'int',
  finishedBook: 'bool',
  progressPhotoCompleted: 'bool',
  noAlcoholCompleted: 'bool',
  alcoholDetails: 'string',
  moodScore: 'int',
  moodNotes: 'string',
  meals: 'string',
  notes: 'string',
  sleepLogged: 'bool',
  sleepCompleted: 'bool',
  sleepMinutes: 'int',
  sleepStartTime: 'string',
  sleepEndTime: 'string',
  sleepQuality: 'int',
  skincareCompleted: 'bool',
  skincareNotes: 'string',
};

const CYCLE_LOG_FIELDS: FieldTypes = {
  userId: 'string',
  date: 'date',
  periodFlow: 'string',
  isPeriodStart: 'bool',
  isPeriodEnd: 'bool',
  symptoms: 'string',
  cervicalMucus: 'string',
  sexualActivity: 'string',
  basalTemp: 'double',
  ovulationTest: 'string',
  notes: 'string',
  cycleDay: 'int',
};

const ACTIVITY_LOG_FIELDS: FieldTypes = {
  userId: 'string',
  challengeId: 'string',
  type: 'string',
  title: 'string',
  description: 'string',
  value: 'double',
  unit: 'string',
  date: 'date',
  createdAt: 'date',
  source: 'string',
  externalId: 'string',
};

const USER_BADGE_FIELDS: FieldTypes = {
  userId: 'string',
  badgeId: 'string',
  challengeId: 'string',
  createdAt: 'date',
};

/** YYYY-MM-DD -> full ISO timestamp so CloudKit stores a real, range-queryable Date. */
function dayToISO(day: string): string {
  return day.length === 10 ? `${day}T00:00:00.000Z` : day;
}

function encodeFields(data: Record<string, any>, types: FieldTypes): Record<string, FieldValue> {
  const fields: Record<string, FieldValue> = {};
  for (const [key, raw] of Object.entries(data)) {
    if (raw === undefined) continue;
    const type = types[key];
    if (!type) continue; // unknown fields are dropped rather than sent untyped
    if (raw === null) {
      fields[key] = { type: 'null' };
      continue;
    }
    fields[key] = { type, value: type === 'date' ? dayToISO(String(raw)) : raw };
  }
  return fields;
}

/**
 * Fields that represent a calendar day (originally plain "YYYY-MM-DD" strings
 * from Appwrite, compared elsewhere in the app as local-midnight Dates) rather
 * than a true instant. Stored in CloudKit as UTC midnight so they're still
 * real, range-queryable Dates — but must come back as a bare day string, not
 * a UTC timestamp, or comparisons against locally-constructed Date objects
 * (e.g. date-fns' eachDayOfInterval/startOfWeek) can be off by the local UTC
 * offset. `createdAt`/`lastLoginTime`/etc. are true instants and stay as-is.
 */
const DAY_FIELDS = new Set(['date', 'startDate', 'endDate', 'lastPeriodStart']);

/** Decodes a record into a doc with $id/$createdAt/$updatedAt aliases, coercing int-encoded bools. */
function decodeRecord(record: RecordOutput, types: FieldTypes): any {
  const doc: any = {
    $id: record.recordName,
    $createdAt: record.createdAt,
    $updatedAt: record.modifiedAt,
  };
  for (const [key, field] of Object.entries(record.fields)) {
    const declared = types[key];
    if (declared === 'bool') {
      doc[key] = field.value === 1 || field.value === true;
    } else if (declared === 'date' && typeof field.value === 'string' && DAY_FIELDS.has(key)) {
      doc[key] = field.value.slice(0, 10);
    } else {
      doc[key] = field.value;
    }
  }
  return doc;
}

function filterValue(type: FieldValue['type'], value: any): FieldValue {
  return { type, value: type === 'date' ? dayToISO(String(value)) : value };
}

// ============================================================
// Low-level operation helpers
// ============================================================

async function savePrivate(
  records: RecordInput[],
  savePolicy: 'allKeys' | 'changedKeys',
  label: string
): Promise<SaveResult> {
  await ensureZone();
  return withRetry(() => native().saveRecords('private', ZONE, records, savePolicy), label);
}

async function saveOne(
  recordType: string,
  recordName: string,
  data: Record<string, any>,
  types: FieldTypes,
  savePolicy: 'allKeys' | 'changedKeys',
  label: string
) {
  const result = await savePrivate(
    [{ recordType, recordName, fields: encodeFields(data, types) }],
    savePolicy,
    label
  );
  if (result.failed.length > 0) {
    const failure = result.failed[0];
    const err = new Error(`${label} failed: ${failure.message}`);
    (err as any).code = failure.code;
    throw err;
  }
  return { $id: recordName, ...data };
}

async function deletePrivate(recordNames: string[], label: string): Promise<SaveResult> {
  if (recordNames.length === 0) return { saved: [], failed: [] };
  await ensureZone();
  const result = await withRetry(() => native().deleteRecords('private', ZONE, recordNames), label);
  // Deleting something already gone is success for our purposes
  result.failed = result.failed.filter((f) => f.code !== 'NOT_FOUND');
  return result;
}

async function fetchOne(recordName: string, types: FieldTypes): Promise<any | null> {
  await ensureZone();
  const res = await withRetry(
    () => native().fetchRecords('private', ZONE, [recordName]),
    `fetch ${recordName}`
  );
  const record = res.found[0];
  return record ? decodeRecord(record, types) : null;
}

async function queryPage(
  recordType: string,
  types: FieldTypes,
  options: {
    filters?: Filter[];
    sorts?: Sort[];
    limit?: number;
    cursor?: string | null;
    desiredKeys?: string[] | null;
  } = {}
): Promise<{ docs: any[]; cursor: string | null }> {
  await ensureZone();
  const res = await withRetry(
    () =>
      native().queryRecords('private', ZONE, recordType, {
        filters: options.filters ?? [],
        sorts: options.sorts ?? [],
        limit: options.limit ?? 0,
        cursor: options.cursor ?? null,
        desiredKeys: options.desiredKeys ?? null,
      }),
    `query ${recordType}`
  );
  return { docs: res.records.map((r) => decodeRecord(r, types)), cursor: res.cursor };
}

/** Cursor-loops until exhausted. */
async function queryAll(
  recordType: string,
  types: FieldTypes,
  options: { filters?: Filter[]; sorts?: Sort[]; desiredKeys?: string[] | null } = {}
): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const page = await queryPage(recordType, types, { ...options, cursor, limit: 400 });
    all.push(...page.docs);
    cursor = page.cursor;
  } while (cursor);
  return all;
}

// ============================================================
// User profile (singleton record "profile")
// ============================================================

export async function createUserProfile(
  authId: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<UserProfile> {
  const data = { authId, email, firstName, lastName, createdAt: new Date().toISOString() };
  const doc = await saveOne('UserProfile', 'profile', data, PROFILE_FIELDS, 'allKeys', 'createUserProfile');
  return doc as unknown as UserProfile;
}

export async function getUserProfile(authId: string): Promise<UserProfile | null> {
  try {
    const doc = await fetchOne('profile', PROFILE_FIELDS);
    if (!doc) return null;
    return {
      $id: doc.$id,
      authId: doc.authId || authId,
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
      createdAt: doc.createdAt || doc.$createdAt,
    } as UserProfile;
  } catch (err) {
    console.error('getUserProfile error:', authId, err);
    return null;
  }
}

export async function updateUserProfile(
  profileId: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  const doc = await saveOne('UserProfile', 'profile', data, PROFILE_FIELDS, 'changedKeys', 'updateUserProfile');
  return doc as unknown as UserProfile;
}

// ============================================================
// Challenge (not a singleton — a user can restart; "latest" = newest createdAt)
// ============================================================

export async function createChallenge(challenge: Omit<Challenge, '$id'>): Promise<Challenge> {
  const recordName = ID.unique();
  const data = { ...challenge, createdAt: new Date().toISOString() };
  const doc = await saveOne('Challenge', recordName, data, CHALLENGE_FIELDS, 'allKeys', 'createChallenge');
  return doc as unknown as Challenge;
}

export async function getChallenge(userId: string): Promise<Challenge | null> {
  try {
    const page = await queryPage('Challenge', CHALLENGE_FIELDS, {
      sorts: [{ field: 'createdAt', ascending: false }],
      limit: 1,
    });
    return (page.docs[0] as unknown as Challenge) ?? null;
  } catch (err) {
    console.error('getChallenge error:', err);
    return null;
  }
}

export async function updateChallenge(challengeId: string, data: Partial<Challenge>): Promise<Challenge> {
  const doc = await saveOne('Challenge', challengeId, data, CHALLENGE_FIELDS, 'changedKeys', 'updateChallenge');
  return doc as unknown as Challenge;
}

// ============================================================
// Daily Log (deterministic recordName: one per challenge+date)
// ============================================================

function dailyLogRecordName(challengeId: string, date: string): string {
  return `dailylog_${challengeId}_${date}`;
}

export async function createDailyLog(log: Omit<DailyLog, '$id'>, userId: string): Promise<DailyLog> {
  const recordName = dailyLogRecordName(log.challengeId, log.date);
  const doc = await saveOne('DailyLog', recordName, { ...log, userId }, DAILY_LOG_FIELDS, 'allKeys', 'createDailyLog');
  return doc as unknown as DailyLog;
}

export async function getDailyLog(challengeId: string, date: string): Promise<DailyLog | null> {
  if (!challengeId || !date) {
    console.warn('getDailyLog called with empty challengeId or date');
    return null;
  }
  try {
    const doc = await fetchOne(dailyLogRecordName(challengeId, date), DAILY_LOG_FIELDS);
    return (doc as unknown as DailyLog) ?? null;
  } catch (err) {
    console.error('getDailyLog error:', err);
    return null;
  }
}

export async function updateDailyLog(logId: string, data: Partial<DailyLog>): Promise<DailyLog> {
  const doc = await saveOne('DailyLog', logId, data, DAILY_LOG_FIELDS, 'changedKeys', 'updateDailyLog');
  return doc as unknown as DailyLog;
}

export async function getDailyLogsForChallenge(challengeId: string): Promise<DailyLog[]> {
  if (!challengeId) {
    console.warn('getDailyLogsForChallenge called with empty challengeId');
    return [];
  }
  try {
    const docs = await queryPage('DailyLog', DAILY_LOG_FIELDS, {
      filters: [{ field: 'challengeId', op: 'eq', value: filterValue('string', challengeId) }],
      sorts: [{ field: 'date', ascending: false }],
      limit: 100,
    });
    return docs.docs as unknown as DailyLog[];
  } catch (err) {
    console.error('getDailyLogsForChallenge error:', err);
    return [];
  }
}

// ============================================================
// Cycle Log (deterministic recordName: one per date)
// ============================================================

function cycleLogRecordName(date: string): string {
  return `cyclelog_${date}`;
}

export async function createCycleLog(log: Omit<CycleLog, '$id'>): Promise<CycleLog> {
  const recordName = cycleLogRecordName(log.date);
  const doc = await saveOne('CycleLog', recordName, log, CYCLE_LOG_FIELDS, 'allKeys', 'createCycleLog');
  return doc as unknown as CycleLog;
}

export async function getCycleLog(userId: string, date: string): Promise<CycleLog | null> {
  try {
    const doc = await fetchOne(cycleLogRecordName(date), CYCLE_LOG_FIELDS);
    return (doc as unknown as CycleLog) ?? null;
  } catch (err) {
    console.error('getCycleLog error:', err);
    return null;
  }
}

export async function updateCycleLog(logId: string, data: Partial<CycleLog>): Promise<CycleLog> {
  const doc = await saveOne('CycleLog', logId, data, CYCLE_LOG_FIELDS, 'changedKeys', 'updateCycleLog');
  return doc as unknown as CycleLog;
}

export async function getCycleLogsForUser(userId: string, limit: number = 90): Promise<CycleLog[]> {
  try {
    const page = await queryPage('CycleLog', CYCLE_LOG_FIELDS, {
      sorts: [{ field: 'date', ascending: false }],
      limit,
    });
    return page.docs as unknown as CycleLog[];
  } catch (err) {
    console.error('getCycleLogsForUser error:', err);
    return [];
  }
}

export async function getLastPeriodStart(userId: string): Promise<CycleLog | null> {
  try {
    const page = await queryPage('CycleLog', CYCLE_LOG_FIELDS, {
      filters: [{ field: 'isPeriodStart', op: 'eq', value: filterValue('bool', true) }],
      sorts: [{ field: 'date', ascending: false }],
      limit: 1,
    });
    return (page.docs[0] as unknown as CycleLog) ?? null;
  } catch (err) {
    console.error('getLastPeriodStart error:', err);
    return null;
  }
}

// ============================================================
// Activity Log (append-only, unique IDs)
// ============================================================

export async function createActivityLog(log: Omit<ActivityLog, '$id'>): Promise<ActivityLog> {
  const recordName = ID.unique();
  const data = { ...log, createdAt: new Date().toISOString() };
  const doc = await saveOne('ActivityLog', recordName, data, ACTIVITY_LOG_FIELDS, 'allKeys', 'createActivityLog');
  return doc as unknown as ActivityLog;
}

export async function getActivityLogs(userId: string, limit: number = 50): Promise<ActivityLog[]> {
  try {
    const page = await queryPage('ActivityLog', ACTIVITY_LOG_FIELDS, {
      sorts: [{ field: 'createdAt', ascending: false }],
      limit,
    });
    return page.docs as unknown as ActivityLog[];
  } catch (err) {
    console.error('getActivityLogs error:', err);
    return [];
  }
}

export async function getActivityLogsForChallenge(challengeId: string, limit: number = 100): Promise<ActivityLog[]> {
  if (!challengeId) {
    console.warn('getActivityLogsForChallenge called with empty challengeId');
    return [];
  }
  try {
    const page = await queryPage('ActivityLog', ACTIVITY_LOG_FIELDS, {
      filters: [{ field: 'challengeId', op: 'eq', value: filterValue('string', challengeId) }],
      sorts: [{ field: 'createdAt', ascending: false }],
      limit,
    });
    return page.docs as unknown as ActivityLog[];
  } catch (err) {
    console.error('getActivityLogsForChallenge error:', err);
    return [];
  }
}

export async function getActivityLogsForDate(
  challengeId: string,
  date: string,
  type?: ActivityType
): Promise<ActivityLog[]> {
  if (!challengeId || !date) {
    console.warn('getActivityLogsForDate called with empty challengeId or date');
    return [];
  }
  try {
    const filters: Filter[] = [
      { field: 'challengeId', op: 'eq', value: filterValue('string', challengeId) },
      { field: 'date', op: 'eq', value: filterValue('date', date) },
    ];
    if (type) {
      filters.push({ field: 'type', op: 'eq', value: filterValue('string', type) });
    }
    const page = await queryPage('ActivityLog', ACTIVITY_LOG_FIELDS, { filters, limit: 400 });
    return page.docs as unknown as ActivityLog[];
  } catch (err) {
    console.error('getActivityLogsForDate error:', err);
    return [];
  }
}

/** Look up a previously-imported log by its source system id (e.g. a Strava activity id), for sync dedup. */
export async function getActivityLogByExternalId(
  challengeId: string,
  externalId: string
): Promise<ActivityLog | null> {
  if (!challengeId || !externalId) return null;
  try {
    const page = await queryPage('ActivityLog', ACTIVITY_LOG_FIELDS, {
      filters: [
        { field: 'challengeId', op: 'eq', value: filterValue('string', challengeId) },
        { field: 'externalId', op: 'eq', value: filterValue('string', externalId) },
      ],
      limit: 1,
    });
    const docs = page.docs as unknown as ActivityLog[];
    return docs[0] ?? null;
  } catch (err) {
    console.error('getActivityLogByExternalId error:', err);
    return null;
  }
}

export async function updateActivityLog(logId: string, data: Partial<ActivityLog>): Promise<ActivityLog> {
  const doc = await saveOne('ActivityLog', logId, data, ACTIVITY_LOG_FIELDS, 'changedKeys', 'updateActivityLog');
  return doc as unknown as ActivityLog;
}

export async function deleteActivityLog(logId: string): Promise<void> {
  const result = await deletePrivate([logId], 'deleteActivityLog');
  if (result.failed.length > 0) {
    throw new Error(result.failed[0].message);
  }
}

// ============================================================
// User Badge (deterministic recordName: one per badge)
// ============================================================

function badgeRecordName(badgeId: BadgeId): string {
  return `badge_${badgeId}`;
}

export async function createUserBadge(
  userId: string,
  badgeId: BadgeId,
  challengeId?: string
): Promise<UserBadge | null> {
  try {
    const existing = await fetchOne(badgeRecordName(badgeId), USER_BADGE_FIELDS);
    if (existing) {
      return existing as unknown as UserBadge;
    }
    const data: Record<string, any> = { userId, badgeId, createdAt: new Date().toISOString() };
    if (challengeId) data.challengeId = challengeId;
    const doc = await saveOne('UserBadge', badgeRecordName(badgeId), data, USER_BADGE_FIELDS, 'allKeys', 'createUserBadge');
    console.log(`🏅 Badge earned: ${badgeId}`);
    return doc as unknown as UserBadge;
  } catch (err) {
    console.error('createUserBadge error:', err);
    return null;
  }
}

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  try {
    const docs = await queryAll('UserBadge', USER_BADGE_FIELDS, {
      sorts: [{ field: 'createdAt', ascending: false }],
    });
    return docs as unknown as UserBadge[];
  } catch (err) {
    console.error('getUserBadges error:', err);
    return [];
  }
}

export async function hasUserBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  try {
    const doc = await fetchOne(badgeRecordName(badgeId), USER_BADGE_FIELDS);
    return doc != null;
  } catch (err) {
    console.error('hasUserBadge error:', err);
    return false;
  }
}

// ============================================================
// Account deletion
// ============================================================

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // The entire private dataset lives in one zone — one operation wipes it all.
    await native().deleteZone(ZONE);
    zoneReady = null;
    return { success: true };
  } catch (err) {
    console.error('deleteUserAccount error:', err);
    captureException(err instanceof Error ? err : new Error(String(err)), {
      operation: 'delete_account',
      userId,
    });
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete account' };
  }
}

// ============================================================
// Migration support (Appwrite -> CloudKit, one-time per user)
// ============================================================

const MIGRATION_FIELDS: FieldTypes = {
  migratedAt: 'date',
  appwriteUserId: 'string',
  counts: 'string', // JSON string of per-collection counts
};

export type MigrationStateDoc = {
  migratedAt: string;
  appwriteUserId?: string;
  counts?: Record<string, number>;
};

export async function getMigrationState(): Promise<MigrationStateDoc | null> {
  const doc = await fetchOne('migration', MIGRATION_FIELDS);
  if (!doc) return null;
  return {
    migratedAt: doc.migratedAt,
    appwriteUserId: doc.appwriteUserId,
    counts: doc.counts ? JSON.parse(doc.counts) : undefined,
  };
}

export async function setMigrationState(appwriteUserId: string, counts: Record<string, number>): Promise<void> {
  await saveOne(
    'MigrationState',
    'migration',
    { migratedAt: new Date().toISOString(), appwriteUserId, counts: JSON.stringify(counts) },
    MIGRATION_FIELDS,
    'allKeys',
    'setMigrationState'
  );
}

/**
 * Writes a Challenge/DailyLog/CycleLog/ActivityLog/UserBadge with a
 * recordName derived from its Appwrite id (where the record type doesn't
 * already have a deterministic key) so a re-run of the migration overwrites
 * rather than duplicates.
 */
export async function migrateChallenge(oldId: string, data: Omit<Challenge, '$id'>): Promise<string> {
  const recordName = `challenge_${oldId}`;
  await saveOne('Challenge', recordName, { ...data, createdAt: data.startDate }, CHALLENGE_FIELDS, 'allKeys', 'migrateChallenge');
  return recordName;
}

export async function migrateUserBadge(badgeId: BadgeId, data: Omit<UserBadge, '$id' | 'badgeId'> & { $createdAt?: string }): Promise<string> {
  const recordName = badgeRecordName(badgeId);
  const { $createdAt, ...rest } = data;
  await saveOne(
    'UserBadge',
    recordName,
    { ...rest, badgeId, createdAt: $createdAt || new Date().toISOString() },
    USER_BADGE_FIELDS,
    'allKeys',
    'migrateUserBadge'
  );
  return recordName;
}

export async function migrateActivityLog(oldId: string, data: Omit<ActivityLog, '$id'>): Promise<string> {
  const recordName = `activitylog_${oldId}`;
  await saveOne(
    'ActivityLog',
    recordName,
    { ...data, createdAt: data.$createdAt || new Date().toISOString() },
    ACTIVITY_LOG_FIELDS,
    'allKeys',
    'migrateActivityLog'
  );
  return recordName;
}
