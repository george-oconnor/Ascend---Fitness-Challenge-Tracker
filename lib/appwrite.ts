import type { Challenge, DailyLog, UserProfile } from "@/types/type";
import { Account, Client, Databases, Query } from "appwrite";

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

// Database config
const DATABASE_ID = "695e69710029eb0c96c6";
const COLLECTIONS = {
  USERS: "users",
  CHALLENGES: "challenges",
  DAILY_LOGS: "dailyLogs",
};

export const appwriteClient = new Client();
if (endpoint && projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(appwriteClient);
export const databases = new Databases(appwriteClient);

// Auth functions
export async function createAccount(email: string, password: string, name: string) {
  return await account.create("unique()", email, password, name);
}

export async function signIn(email: string, password: string) {
  return await account.createEmailPasswordSession(email, password);
}

export async function signOut() {
  try {
    return await account.deleteSession("current");
  } catch (err) {
    console.error("signOut error:", err);
    throw err;
  }
}

export async function getCurrentSession() {
  try {
    return await account.getSession("current");
  } catch (err) {
    return null;
  }
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch (err) {
    return null;
  }
}

export async function requestPasswordReset(email: string) {
  return await account.createRecovery(email, `${process.env.EXPO_PUBLIC_RESET_PASSWORD_URL || "http://localhost:3000"}/reset-password`);
}

export async function resetPassword(userId: string, secret: string, newPassword: string) {
  return await account.updateRecovery(userId, secret, newPassword);
}

// User Profile functions
export async function createUserProfile(authId: string, email: string, firstName: string, lastName: string): Promise<UserProfile> {
  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.USERS,
    "unique()",
    {
      authId,
      email,
      firstName,
      lastName,
      createdAt: new Date().toISOString(),
    }
  );
  return doc as unknown as UserProfile;
}

export async function getUserProfile(authId: string): Promise<UserProfile | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USERS,
      [Query.equal("authId", authId)]
    );
    if (response.documents.length > 0) {
      return response.documents[0] as unknown as UserProfile;
    }
    return null;
  } catch (err) {
    console.error("getUserProfile error:", err);
    return null;
  }
}

// Challenge functions
export async function createChallenge(challenge: Omit<Challenge, "$id">): Promise<Challenge> {
  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.CHALLENGES,
    "unique()",
    challenge
  );
  return doc as unknown as Challenge;
}

export async function getChallenge(userId: string): Promise<Challenge | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CHALLENGES,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt"), Query.limit(1)]
    );
    if (response.documents.length > 0) {
      return response.documents[0] as unknown as Challenge;
    }
    return null;
  } catch (err) {
    console.error("getChallenge error:", err);
    return null;
  }
}

export async function updateChallenge(challengeId: string, data: Partial<Challenge>): Promise<Challenge> {
  const doc = await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.CHALLENGES,
    challengeId,
    data
  );
  return doc as unknown as Challenge;
}

// Daily Log functions
export async function createDailyLog(log: Omit<DailyLog, "$id">): Promise<DailyLog> {
  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.DAILY_LOGS,
    "unique()",
    log
  );
  return doc as unknown as DailyLog;
}

export async function getDailyLog(challengeId: string, date: string): Promise<DailyLog | null> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DAILY_LOGS,
      [Query.equal("challengeId", challengeId), Query.equal("date", date)]
    );
    if (response.documents.length > 0) {
      return response.documents[0] as unknown as DailyLog;
    }
    return null;
  } catch (err) {
    console.error("getDailyLog error:", err);
    return null;
  }
}

export async function updateDailyLog(logId: string, data: Partial<DailyLog>): Promise<DailyLog> {
  const doc = await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.DAILY_LOGS,
    logId,
    data
  );
  return doc as unknown as DailyLog;
}

export async function getDailyLogsForChallenge(challengeId: string): Promise<DailyLog[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DAILY_LOGS,
      [Query.equal("challengeId", challengeId), Query.orderDesc("date"), Query.limit(100)]
    );
    return response.documents as unknown as DailyLog[];
  } catch (err) {
    console.error("getDailyLogsForChallenge error:", err);
    return [];
  }
}


