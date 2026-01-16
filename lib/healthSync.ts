/**
 * Health Sync Service - Apple HealthKit integration for various health metrics
 * Uses @kingstinct/react-native-healthkit for water, weight, calories, sleep, and mood
 */

import { logger } from "@/lib/sentry";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Check if running in Expo Go (NitroModules don't work there)
const isExpoGo = Constants.appOwnership === "expo";

// HealthKit Quantity Type Identifiers
const HKQuantityTypes = {
  DietaryWater: "HKQuantityTypeIdentifierDietaryWater",
  BodyMass: "HKQuantityTypeIdentifierBodyMass",
  DietaryEnergyConsumed: "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  ActiveEnergyBurned: "HKQuantityTypeIdentifierActiveEnergyBurned",
} as const;

// HealthKit Category Type Identifiers
const HKCategoryTypes = {
  SleepAnalysis: "HKCategoryTypeIdentifierSleepAnalysis",
} as const;

// Sleep analysis values
export enum HKCategoryValueSleepAnalysis {
  InBed = 0,
  Asleep = 1,
  Awake = 2,
  AsleepCore = 3, // iOS 16+
  AsleepDeep = 4, // iOS 16+
  AsleepREM = 5, // iOS 16+
}

// Unit types
const HKUnits = {
  Liter: "l",
  Milliliter: "ml",
  FluidOunceUS: "fl_oz_us",
  Kilogram: "kg",
  Pound: "lb",
  Kilocalorie: "kcal",
  Minute: "min",
  Hour: "hr",
} as const;

class HealthSyncService {
  private HealthKit: any = null;
  private moduleLoadAttempted = false;
  private moduleAvailable = false;
  private isAuthorized = false;

  /**
   * Check if HealthKit is available (iOS only)
   */
  isAvailable(): boolean {
    if (Platform.OS !== "ios") return false;
    this.loadModule();
    return this.moduleAvailable && this.HealthKit !== null;
  }

  /**
   * Load the HealthKit module lazily
   */
  private loadModule(): boolean {
    if (this.moduleLoadAttempted) {
      return this.moduleAvailable;
    }

    this.moduleLoadAttempted = true;

    if (Platform.OS !== "ios") {
      console.log("HealthSync: Not available on this platform");
      this.moduleAvailable = false;
      return false;
    }

    // Skip loading in Expo Go - NitroModules are not supported
    if (isExpoGo) {
      console.log("⚠️ HealthSync: Skipping HealthKit in Expo Go environment");
      this.moduleAvailable = false;
      return false;
    }

    try {
      const module = require("@kingstinct/react-native-healthkit");
      
      // Validate that the module actually loaded with required functions
      if (!module || typeof module.requestAuthorization !== "function") {
        console.log("⚠️ HealthSync: Module loaded but not functional");
        this.moduleAvailable = false;
        return false;
      }
      
      this.HealthKit = module;
      this.moduleAvailable = true;
      console.log("✅ HealthSync: @kingstinct/react-native-healthkit loaded");
      return true;
    } catch (error: any) {
      // Only log once, not as an error since this is expected in Expo Go
      console.log("⚠️ HealthSync: HealthKit not available -", error?.message);
      this.moduleAvailable = false;
      return false;
    }
  }

  /**
   * Request authorization for all health data types we need
   */
  async requestAuthorization(): Promise<boolean> {
    if (!this.loadModule() || !this.HealthKit) return false;

    try {
      const { requestAuthorization } = this.HealthKit;

      if (!requestAuthorization) {
        console.warn("HealthSync: requestAuthorization not available");
        return false;
      }

      // Request read and write permissions for quantity types
      // @kingstinct/react-native-healthkit uses { toRead, toShare } format
      const toRead = [
        HKQuantityTypes.DietaryWater,
        HKQuantityTypes.BodyMass,
        HKQuantityTypes.DietaryEnergyConsumed,
        HKQuantityTypes.ActiveEnergyBurned,
        HKCategoryTypes.SleepAnalysis,
        "HKDataTypeIdentifierStateOfMind", // Mood - iOS 17+
      ];

      const toShare = [
        HKQuantityTypes.DietaryWater,
        HKQuantityTypes.BodyMass,
        HKQuantityTypes.DietaryEnergyConsumed,
        HKCategoryTypes.SleepAnalysis,
        "HKDataTypeIdentifierStateOfMind", // Mood - iOS 17+
      ];

      await requestAuthorization({ toRead, toShare });
      this.isAuthorized = true;
      console.log("✅ HealthSync: Authorization granted");
      return true;
    } catch (error: any) {
      console.error("❌ HealthSync: Authorization failed:", error);
      return false;
    }
  }

  /**
   * Ensure authorization before any operation
   */
  private async ensureAuthorized(): Promise<boolean> {
    if (!this.loadModule() || !this.HealthKit) return false;
    if (!this.isAuthorized) {
      return await this.requestAuthorization();
    }
    return true;
  }

  // ==================== WATER ====================

  /**
   * Save water intake to Apple Health
   * @param liters Amount of water in liters
   * @param date Date of the intake (defaults to now)
   */
  async saveWaterIntake(liters: number, date: Date = new Date()): Promise<boolean> {
    if (!await this.ensureAuthorized()) return false;

    try {
      const { saveQuantitySample } = this.HealthKit;

      if (!saveQuantitySample) {
        console.warn("HealthSync: saveQuantitySample not available");
        return false;
      }

      await saveQuantitySample(HKQuantityTypes.DietaryWater, HKUnits.Liter, liters, date, date);

      logger.info("Apple Health sync: water saved", { type: "water", liters, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to save water:", error);
      return false;
    }
  }

  /**
   * Get total water intake for a specific date from Apple Health
   * @param date Date to query
   * @returns Total water in liters, or null if unavailable
   */
  async getWaterIntakeForDate(date: Date): Promise<number | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryQuantitySamples } = this.HealthKit;

      if (!queryQuantitySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // queryQuantitySamples expects: (identifier, { filter: { date: { startDate, endDate } }, unit, limit })
      const samples = await queryQuantitySamples(HKQuantityTypes.DietaryWater, {
        filter: {
          date: {
            startDate: startOfDay,
            endDate: endOfDay,
          },
        },
        unit: HKUnits.Liter,
        limit: 0, // 0 or negative = fetch all
      });

      if (samples && samples.length > 0) {
        // Sum all water samples for the day
        const totalLiters = samples.reduce(
          (sum: number, sample: any) => sum + (sample.quantity || 0),
          0
        );
        return Math.round(totalLiters * 100) / 100; // Round to 2 decimal places
      }

      return null;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to get water:", error);
      return null;
    }
  }

  // ==================== WEIGHT ====================

  /**
   * Save weight to Apple Health
   * @param kilograms Weight in kilograms
   * @param date Date of the measurement (defaults to now)
   */
  async saveWeight(kilograms: number, date: Date = new Date()): Promise<boolean> {
    if (!await this.ensureAuthorized()) return false;

    try {
      const { saveQuantitySample } = this.HealthKit;

      if (!saveQuantitySample) {
        console.warn("HealthSync: saveQuantitySample not available");
        return false;
      }

      await saveQuantitySample(HKQuantityTypes.BodyMass, HKUnits.Kilogram, kilograms, date, date);

      logger.info("Apple Health sync: weight saved", { type: "weight", kilograms, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to save weight:", error);
      return false;
    }
  }

  /**
   * Get most recent weight from Apple Health for a specific date
   * @param date Date to query
   * @returns Weight in kilograms, or null if unavailable
   */
  async getWeightForDate(date: Date): Promise<number | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryQuantitySamples } = this.HealthKit;

      if (!queryQuantitySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // queryQuantitySamples expects: (identifier, { filter: { date: { startDate, endDate } }, unit, limit, ascending })
      const samples = await queryQuantitySamples(HKQuantityTypes.BodyMass, {
        filter: {
          date: {
            startDate: startOfDay,
            endDate: endOfDay,
          },
        },
        unit: HKUnits.Kilogram,
        limit: 1,
        ascending: false, // Most recent first
      });

      if (samples && samples.length > 0) {
        return Math.round(samples[0].quantity * 10) / 10; // Round to 1 decimal
      }

      return null;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to get weight:", error);
      return null;
    }
  }

  /**
   * Get most recent weight from Apple Health (any date)
   * @returns Weight in kilograms, or null if unavailable
   */
  async getLatestWeight(): Promise<{ weight: number; date: Date } | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryQuantitySamples } = this.HealthKit;

      if (!queryQuantitySamples) return null;

      // Query last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const samples = await queryQuantitySamples(HKQuantityTypes.BodyMass, {
        filter: {
          date: {
            startDate,
            endDate,
          },
        },
        unit: HKUnits.Kilogram,
        limit: 1,
        ascending: false,
      });

      if (samples && samples.length > 0) {
        const sample = samples[0];
        return {
          weight: Math.round(sample.quantity * 10) / 10,
          date: new Date(sample.startDate),
        };
      }

      return null;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to get latest weight:", error);
      return null;
    }
  }

  // ==================== CALORIES ====================

  /**
   * Save dietary calories to Apple Health
   * @param calories Calories consumed
   * @param date Date of consumption (defaults to now)
   * @param mealName Optional meal name for metadata
   */
  async saveCalories(
    calories: number,
    date: Date = new Date(),
    mealName?: string
  ): Promise<boolean> {
    if (!await this.ensureAuthorized()) return false;

    try {
      const { saveQuantitySample } = this.HealthKit;

      if (!saveQuantitySample) {
        console.warn("HealthSync: saveQuantitySample not available");
        return false;
      }

      const metadata = mealName ? { HKFoodMeal: mealName } : undefined;

      await saveQuantitySample(
        HKQuantityTypes.DietaryEnergyConsumed,
        HKUnits.Kilocalorie,
        calories,
        date,
        date,
        metadata
      );

      logger.info("Apple Health sync: calories saved", { type: "calories", calories, mealName: mealName || "unspecified", date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to save calories:", error);
      return false;
    }
  }

  /**
   * Get total dietary calories for a specific date
   * @param date Date to query
   * @returns Total calories, or null if unavailable
   */
  async getCaloriesForDate(date: Date): Promise<number | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryQuantitySamples } = this.HealthKit;

      if (!queryQuantitySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // queryQuantitySamples expects: (identifier, { filter: { date: { startDate, endDate } }, unit, limit })
      const samples = await queryQuantitySamples(HKQuantityTypes.DietaryEnergyConsumed, {
        filter: {
          date: {
            startDate: startOfDay,
            endDate: endOfDay,
          },
        },
        unit: HKUnits.Kilocalorie,
        limit: 0, // 0 or negative = fetch all
      });

      if (samples && samples.length > 0) {
        // Sum all calorie samples for the day
        const totalCalories = samples.reduce(
          (sum: number, sample: any) => sum + (sample.quantity || 0),
          0
        );
        return Math.round(totalCalories);
      }

      return null;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to get calories:", error);
      return null;
    }
  }

  // ==================== SLEEP ====================

  /**
   * Save sleep data to Apple Health
   * @param startTime When sleep started
   * @param endTime When sleep ended
   * @param sleepType Type of sleep (default: Asleep)
   */
  async saveSleep(
    startTime: Date,
    endTime: Date,
    sleepType: HKCategoryValueSleepAnalysis = HKCategoryValueSleepAnalysis.Asleep
  ): Promise<boolean> {
    if (!await this.ensureAuthorized()) return false;

    try {
      const { saveCategorySample } = this.HealthKit;

      if (!saveCategorySample) {
        console.warn("HealthSync: saveCategorySample not available");
        return false;
      }

      // @kingstinct/react-native-healthkit saveCategorySample signature:
      // saveCategorySample(identifier, value, startDate, endDate, metadata?)
      await saveCategorySample(
        HKCategoryTypes.SleepAnalysis,
        sleepType,
        startTime,
        endTime
      );

      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      logger.info("Apple Health sync: sleep saved", { type: "sleep", durationMinutes, startTime: startTime.toISOString(), endTime: endTime.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to save sleep:", error);
      return false;
    }
  }

  /**
   * Get sleep data for a specific night (queries from 6pm previous day to 12pm target day)
   * @param date The morning date of the sleep (e.g., today for last night's sleep)
   * @returns Sleep data including total duration and breakdown, or null
   */
  async getSleepForDate(date: Date): Promise<{
    totalMinutes: number;
    inBedMinutes: number;
    asleepMinutes: number;
    awakeMinutes: number;
    deepMinutes: number;
    remMinutes: number;
    coreMinutes: number;
    startTime: Date | null;
    endTime: Date | null;
  } | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryCategorySamples } = this.HealthKit;

      if (!queryCategorySamples) return null;

      // Query from 6pm previous day to 12pm target day to capture full night
      const startQuery = new Date(date);
      startQuery.setDate(startQuery.getDate() - 1);
      startQuery.setHours(18, 0, 0, 0);

      const endQuery = new Date(date);
      endQuery.setHours(12, 0, 0, 0);

      // queryCategorySamples expects: (identifier, { filter: { date: { startDate, endDate } }, limit })
      const samples = await queryCategorySamples(HKCategoryTypes.SleepAnalysis, {
        filter: {
          date: {
            startDate: startQuery,
            endDate: endQuery,
          },
        },
        limit: 0, // 0 or negative = fetch all
      });

      if (!samples || samples.length === 0) {
        return null;
      }

      let inBedMinutes = 0;
      let asleepMinutes = 0;
      let awakeMinutes = 0;
      let deepMinutes = 0;
      let remMinutes = 0;
      let coreMinutes = 0;
      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;

      for (const sample of samples) {
        const start = new Date(sample.startDate);
        const end = new Date(sample.endDate);
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;

        // Track overall sleep window
        if (!earliestStart || start < earliestStart) earliestStart = start;
        if (!latestEnd || end > latestEnd) latestEnd = end;

        switch (sample.value) {
          case HKCategoryValueSleepAnalysis.InBed:
            inBedMinutes += durationMinutes;
            break;
          case HKCategoryValueSleepAnalysis.Asleep:
            asleepMinutes += durationMinutes;
            break;
          case HKCategoryValueSleepAnalysis.Awake:
            awakeMinutes += durationMinutes;
            break;
          case HKCategoryValueSleepAnalysis.AsleepDeep:
            deepMinutes += durationMinutes;
            break;
          case HKCategoryValueSleepAnalysis.AsleepREM:
            remMinutes += durationMinutes;
            break;
          case HKCategoryValueSleepAnalysis.AsleepCore:
            coreMinutes += durationMinutes;
            break;
        }
      }

      // Total asleep time includes all sleep stages
      const totalAsleep = asleepMinutes + deepMinutes + remMinutes + coreMinutes;

      return {
        totalMinutes: Math.round(totalAsleep),
        inBedMinutes: Math.round(inBedMinutes),
        asleepMinutes: Math.round(asleepMinutes),
        awakeMinutes: Math.round(awakeMinutes),
        deepMinutes: Math.round(deepMinutes),
        remMinutes: Math.round(remMinutes),
        coreMinutes: Math.round(coreMinutes),
        startTime: earliestStart,
        endTime: latestEnd,
      };
    } catch (error: any) {
      console.error("❌ HealthSync: Failed to get sleep:", error);
      return null;
    }
  }

  // ==================== MOOD (State of Mind - iOS 17+) ====================

  /**
   * Mood kind types for State of Mind
   */
  static readonly MoodKind = {
    DailyMood: 1,
    MomentaryEmotion: 2,
  } as const;

  /**
   * Mood valence mapping (our 1-5 scale to HealthKit's -1 to 1)
   * 1 = Very Unpleasant (-1.0)
   * 2 = Unpleasant (-0.5)
   * 3 = Neutral (0.0)
   * 4 = Pleasant (0.5)
   * 5 = Very Pleasant (1.0)
   */
  private moodScoreToValence(score: number): number {
    const mapping: Record<number, number> = {
      1: -1.0,
      2: -0.5,
      3: 0.0,
      4: 0.5,
      5: 1.0,
    };
    return mapping[score] ?? 0.0;
  }

  /**
   * Convert HealthKit valence back to our 1-5 scale
   */
  private valenceToMoodScore(valence: number): number {
    if (valence <= -0.75) return 1;
    if (valence <= -0.25) return 2;
    if (valence <= 0.25) return 3;
    if (valence <= 0.75) return 4;
    return 5;
  }

  /**
   * HealthKit emotion labels that map to our emotion IDs
   */
  private readonly emotionMapping: Record<string, string> = {
    // Our emotions -> HealthKit HKStateOfMind.Label values
    tired: "tired",
    energetic: "energized",
    anxious: "anxious",
    calm: "calm",
    stressed: "stressed",
    irritable: "annoyed",
    sensitive: "sensitive",
    overwhelmed: "overwhelmed",
    frustrated: "frustrated",
    restless: "unsettled",
    excited: "excited",
    grateful: "grateful",
    motivated: "confident",
    lonely: "lonely",
    hopeful: "hopeful",
    content: "content",
    sad: "sad",
    angry: "angry",
    worried: "worried",
    confused: "confused",
    peaceful: "peaceful",
    joyful: "joyful",
    proud: "proud",
    relieved: "relieved",
    indifferent: "indifferent",
    disappointed: "disappointed",
    guilty: "guilty",
    embarrassed: "embarrassed",
  };

  /**
   * Save mood to Apple Health State of Mind (iOS 17+)
   * @param score Mood score (1-5)
   * @param emotions Array of emotion IDs
   * @param date Date of the mood entry
   */
  async saveMood(
    score: number,
    emotions: string[] = [],
    date: Date = new Date()
  ): Promise<boolean> {
    if (!await this.ensureAuthorized()) return false;

    try {
      const { saveStateOfMindSample } = this.HealthKit;

      if (!saveStateOfMindSample) {
        // State of Mind might not be available (iOS 17+ only)
        console.log("HealthSync: State of Mind not available (requires iOS 17+)");
        return false;
      }

      const valence = this.moodScoreToValence(score);

      // Map our emotion IDs to HealthKit labels
      const hkLabels = emotions
        .map((e) => this.emotionMapping[e])
        .filter(Boolean);

      // saveStateOfMindSample expects positional args: (date, kind, valence, labels, associations, metadata?)
      await saveStateOfMindSample(
        date,
        HealthSyncService.MoodKind.DailyMood,
        valence,
        hkLabels,
        [] // associations (empty)
      );

      logger.info("Apple Health sync: mood saved", { type: "mood", score, valence, emotionCount: emotions.length, date: date.toISOString() });
      return true;
    } catch (error: any) {
      // Don't log error for unsupported iOS versions
      if (error?.message?.includes("not available")) {
        console.log("HealthSync: State of Mind not available");
      } else {
        console.error("❌ HealthSync: Failed to save mood:", error);
      }
      return false;
    }
  }

  /**
   * Get mood data for a specific date from Apple Health
   * @param date Date to query
   * @returns Mood data or null
   */
  async getMoodForDate(date: Date): Promise<{
    score: number;
    emotions: string[];
  } | null> {
    if (!await this.ensureAuthorized()) return null;

    try {
      const { queryStateOfMindSamples } = this.HealthKit;

      if (!queryStateOfMindSamples) {
        console.log("HealthSync: State of Mind query not available");
        return null;
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // queryStateOfMindSamples expects: ({ filter: { date: { startDate, endDate } }, limit })
      const samples = await queryStateOfMindSamples({
        filter: {
          date: {
            startDate: startOfDay,
            endDate: endOfDay,
          },
        },
        limit: 0, // 0 or negative = fetch all
      });

      if (samples && samples.length > 0) {
        // Get most recent mood for the day
        const sample = samples[samples.length - 1];
        const score = this.valenceToMoodScore(sample.valence);

        // Reverse map HealthKit labels back to our emotion IDs
        const reverseMapping = Object.entries(this.emotionMapping).reduce(
          (acc, [key, value]) => {
            acc[value] = key;
            return acc;
          },
          {} as Record<string, string>
        );

        const emotions = (sample.labels || [])
          .map((label: string) => reverseMapping[label])
          .filter(Boolean);

        return { score, emotions };
      }

      return null;
    } catch (error: any) {
      console.log("HealthSync: Failed to get mood:", error?.message);
      return null;
    }
  }

  // ==================== COMBINED METHODS ====================

  /**
   * Get all health data for a specific date
   */
  async getAllDataForDate(date: Date): Promise<{
    water: number | null;
    weight: number | null;
    calories: number | null;
    sleep: {
      totalMinutes: number;
      inBedMinutes: number;
      asleepMinutes: number;
      awakeMinutes: number;
      deepMinutes: number;
      remMinutes: number;
      coreMinutes: number;
      startTime: Date | null;
      endTime: Date | null;
    } | null;
    mood: {
      score: number;
      emotions: string[];
    } | null;
  }> {
    const [water, weight, calories, sleep, mood] = await Promise.all([
      this.getWaterIntakeForDate(date),
      this.getWeightForDate(date),
      this.getCaloriesForDate(date),
      this.getSleepForDate(date),
      this.getMoodForDate(date),
    ]);

    return { water, weight, calories, sleep, mood };
  }
}

// Export singleton instance
export const healthSyncService = new HealthSyncService();
