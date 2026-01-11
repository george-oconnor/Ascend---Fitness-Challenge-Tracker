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
  trackCalories: boolean;
  caloriesGoal: number;
  caloriesGoalDirection?: "above" | "below"; // Whether to stay above or below the calorie goal
  trackWeight: boolean;
  weightGoal: number;
  trackWorkout1: boolean;
  trackWorkout2: boolean;
  workoutMinutes: number;
  trackReading: boolean;
  readingPages: number;
  trackProgressPhoto: boolean;
  progressPhotoDays?: number; // Every X days (default 1 for daily)
  trackNoAlcohol: boolean;
  trackMood: boolean;
  trackSleep: boolean;
  sleepGoalHours?: number;
  trackCycle: boolean;
  averageCycleLength?: number;
  averagePeriodLength?: number;
  lastPeriodStart?: string;
  trackSkincare: boolean;
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
  calorieDetails?: string;
  currentWeight?: number;
  weightLogged?: boolean;
  workout1Completed?: boolean;
  workout1Minutes?: number;
  workout2Completed?: boolean;
  workout2Minutes?: number;
  workoutDetails?: string;
  readingCompleted?: boolean;
  readingPages?: number;
  finishedBook?: boolean;
  progressPhotoCompleted?: boolean;
  noAlcoholCompleted?: boolean;
  alcoholDetails?: string;
  moodScore?: number;
  moodNotes?: string;
  meals?: string;
  notes?: string;
  // Sleep tracking
  sleepLogged?: boolean;
  sleepMinutes?: number;
  sleepStartTime?: string;
  sleepEndTime?: string;
  sleepQuality?: number; // 1-5 rating
  // Skincare tracking
  skincareCompleted?: boolean;
  skincareNotes?: string;
};

export type UserProfile = {
  $id?: string;
  authId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  badges?: string; // JSON array of earned badge IDs
};

// Badge System Types
export type BadgeId = 
  // Streak badges
  | "streak_3" | "streak_7" | "streak_14" | "streak_30"
  // Challenge progress badges
  | "day_1" | "week_1" | "day_25" | "day_50" | "day_75" | "challenge_complete"
  // Workout badges
  | "workout_10" | "workout_25" | "workout_50" | "workout_100"
  // Reading badges
  | "pages_100" | "pages_500" | "pages_1000" | "book_finished"
  // Steps badges
  | "steps_10k" | "steps_15k" | "steps_20k"
  // Water badges
  | "hydration_7" | "hydration_30"
  // Photo badges
  | "photo_7" | "photo_30"
  // Special badges
  | "early_bird" | "night_owl" | "perfect_day";

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  icon: string; // Feather icon name
  color: string;
  bgColor: string;
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

// Cycle Tracking Types (Beta)
export type PeriodFlow = "none" | "spotting" | "light" | "medium" | "heavy";

export type CycleSymptom = 
  // Physical
  | "cramps" | "bloating" | "breast_tenderness" | "headache" | "migraine"
  | "fatigue" | "backache" | "acne" | "nausea" | "dizziness"
  | "hot_flashes" | "chills" | "appetite_increase" | "appetite_decrease"
  | "cravings" | "insomnia" | "joint_pain" | "muscle_aches"
  // Digestive
  | "constipation" | "diarrhea" | "gas"
  // Emotional/Mental (integrated with mood tracking)
  | "mood_swings" | "anxiety" | "irritability" | "depression" 
  | "crying" | "stress" | "brain_fog" | "low_energy" | "high_energy"
  | "tired" | "energetic" | "calm" | "excited" | "grateful" 
  | "motivated" | "frustrated" | "hopeful" | "lonely" | "focused"
  | "sensitive" | "overwhelmed" | "content" | "restless";

export type CervicalMucus = "dry" | "sticky" | "creamy" | "watery" | "egg_white";

export type SexualActivityType = {
  hadActivity: boolean;
  protected?: boolean;
  notes?: string;
};

export type CycleLog = {
  $id?: string;
  userId: string;
  date: string;
  periodFlow?: PeriodFlow;
  isPeriodStart?: boolean;
  isPeriodEnd?: boolean;
  symptoms?: string; // JSON array of CycleSymptom
  cervicalMucus?: CervicalMucus;
  sexualActivity?: string; // JSON of SexualActivityType
  basalTemp?: number;
  ovulationTest?: "positive" | "negative" | "not_taken";
  notes?: string;
  cycleDay?: number;
};

// Activity Feed Types
export type ActivityType = 
  | "steps" | "workout1" | "workout2" | "water" | "diet" 
  | "reading" | "photo" | "alcohol" | "weight" | "mood" 
  | "calories" | "cycle" | "sleep" | "skincare";

export type ActivityLog = {
  $id?: string;
  $createdAt?: string; // Appwrite's built-in timestamp
  userId: string;
  challengeId: string;
  type: ActivityType;
  title: string;
  description: string;
  value?: number; // Numeric value if applicable (steps, minutes, liters, etc.)
  unit?: string; // Unit for the value (steps, min, L, kg, etc.)
  date: string; // The date this activity is for (YYYY-MM-DD)
};
