// 75 Hard Challenge Types
export type Challenge = {
  $id?: string;
  userId: string;
  startDate: string;
  totalDays: number;
  trackSteps: boolean;
  stepsGoal: number;
  trackWater: boolean;
  waterLiters: number;
  trackDiet: boolean;
  caloriesGoal: number;
  trackWeight: boolean;
  weightGoal: number;
  trackWorkout1: boolean;
  trackWorkout2: boolean;
  workoutMinutes: number;
  trackReading: boolean;
  readingPages: number;
  trackProgressPhoto: boolean;
  trackNoAlcohol: boolean;
};

export type DailyLog = {
  $id?: string;
  userId: string;
  challengeId: string;
  date: string;
  stepsCompleted?: boolean;
  stepsCount?: number;
  waterCompleted?: boolean;
  waterLiters?: number;
  dietCompleted?: boolean;
  caloriesConsumed?: number;
  currentWeight?: number;
  workout1Completed?: boolean;
  workout1Minutes?: number;
  workout2Completed?: boolean;
  workout2Minutes?: number;
  readingCompleted?: boolean;
  readingPages?: number;
  progressPhotoCompleted?: boolean;
  noAlcoholCompleted?: boolean;
  meals?: string;
  notes?: string;
};

export type UserProfile = {
  $id?: string;
  authId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
};

export type SessionStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
};

export type SessionState = {
  user: SessionUser | null;
  token: string | null;
  status: SessionStatus;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (payload: { user: SessionUser; token: string }) => void;
  setStatus: (status: SessionStatus) => void;
  setError: (message: string | null) => void;
  clearSession: () => void;
};
