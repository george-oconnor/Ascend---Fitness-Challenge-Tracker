/**
 * Cycle Health Service - Apple HealthKit integration for cycle tracking
 * Uses @kingstinct/react-native-healthkit for reproductive health data
 */

import { logger } from "@/lib/sentry";
import { CervicalMucus, PeriodFlow, SexualActivityType } from "@/types/type.d";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Check if running in Expo Go (NitroModules don't work there)
const isExpoGo = Constants.appOwnership === "expo";

// HealthKit Category Values for Menstrual Flow
export enum HKCategoryValueMenstrualFlow {
  Unspecified = 1,
  Light = 2,
  Medium = 3,
  Heavy = 4,
  None = 5,
}

// HealthKit Category Values for Cervical Mucus Quality
export enum HKCategoryValueCervicalMucusQuality {
  Dry = 1,
  Sticky = 2,
  Creamy = 3,
  Watery = 4,
  EggWhite = 5,
}

// HealthKit Category Values for Ovulation Test Result
export enum HKCategoryValueOvulationTestResult {
  Negative = 1,
  LuteinizingHormoneSurge = 2, // Positive
  Indeterminate = 3,
  EstrogenSurge = 4,
}

// Map our app's flow values to HealthKit values
function mapFlowToHealthKit(flow: PeriodFlow): HKCategoryValueMenstrualFlow | null {
  switch (flow) {
    case "none":
      return null; // Don't save "none" to HealthKit
    case "spotting":
      return HKCategoryValueMenstrualFlow.Light;
    case "light":
      return HKCategoryValueMenstrualFlow.Light;
    case "medium":
      return HKCategoryValueMenstrualFlow.Medium;
    case "heavy":
      return HKCategoryValueMenstrualFlow.Heavy;
    default:
      return null;
  }
}

// Map HealthKit flow values to our app's values
function mapFlowFromHealthKit(value: number): PeriodFlow {
  switch (value) {
    case HKCategoryValueMenstrualFlow.Light:
      return "light";
    case HKCategoryValueMenstrualFlow.Medium:
      return "medium";
    case HKCategoryValueMenstrualFlow.Heavy:
      return "heavy";
    case HKCategoryValueMenstrualFlow.None:
      return "none";
    default:
      return "none";
  }
}

// Map our cervical mucus values to HealthKit
function mapMucusToHealthKit(mucus: CervicalMucus): HKCategoryValueCervicalMucusQuality {
  switch (mucus) {
    case "dry":
      return HKCategoryValueCervicalMucusQuality.Dry;
    case "sticky":
      return HKCategoryValueCervicalMucusQuality.Sticky;
    case "creamy":
      return HKCategoryValueCervicalMucusQuality.Creamy;
    case "watery":
      return HKCategoryValueCervicalMucusQuality.Watery;
    case "egg_white":
      return HKCategoryValueCervicalMucusQuality.EggWhite;
    default:
      return HKCategoryValueCervicalMucusQuality.Dry;
  }
}

// Map HealthKit cervical mucus to our app's values
function mapMucusFromHealthKit(value: number): CervicalMucus {
  switch (value) {
    case HKCategoryValueCervicalMucusQuality.Dry:
      return "dry";
    case HKCategoryValueCervicalMucusQuality.Sticky:
      return "sticky";
    case HKCategoryValueCervicalMucusQuality.Creamy:
      return "creamy";
    case HKCategoryValueCervicalMucusQuality.Watery:
      return "watery";
    case HKCategoryValueCervicalMucusQuality.EggWhite:
      return "egg_white";
    default:
      return "dry";
  }
}

// Map ovulation test result
function mapOvulationToHealthKit(result: "positive" | "negative" | "not_taken"): HKCategoryValueOvulationTestResult | null {
  switch (result) {
    case "positive":
      return HKCategoryValueOvulationTestResult.LuteinizingHormoneSurge;
    case "negative":
      return HKCategoryValueOvulationTestResult.Negative;
    case "not_taken":
      return null; // Don't save "not taken" to HealthKit
    default:
      return null;
  }
}

export type CycleHealthData = {
  periodFlow?: PeriodFlow;
  cervicalMucus?: CervicalMucus;
  ovulationTestResult?: "positive" | "negative";
  sexualActivity?: boolean;
  sexualActivityProtected?: boolean;
};

class CycleHealthService {
  private HealthKit: any = null;
  private isModuleLoaded = false;
  private moduleLoadError: string | null = null;
  private isAuthorized = false;
  private moduleAvailable = false;

  /**
   * Lazy load the HealthKit module
   */
  private loadModule(): boolean {
    if (this.isModuleLoaded) {
      return this.moduleAvailable;
    }

    this.isModuleLoaded = true;

    if (Platform.OS !== "ios") {
      this.moduleLoadError = "HealthKit is only available on iOS";
      this.moduleAvailable = false;
      return false;
    }

    // Skip loading in Expo Go - NitroModules are not supported
    if (isExpoGo) {
      this.moduleLoadError = "HealthKit not available in Expo Go (use development build)";
      this.moduleAvailable = false;
      console.log("⚠️ CycleHealth: Skipping HealthKit in Expo Go environment");
      return false;
    }

    try {
      // Import @kingstinct/react-native-healthkit
      const HealthKitModule = require("@kingstinct/react-native-healthkit");
      
      // Validate that the module actually loaded with required functions
      if (!HealthKitModule || typeof HealthKitModule.requestAuthorization !== "function") {
        this.moduleLoadError = "HealthKit module not properly initialized";
        this.moduleAvailable = false;
        console.log("⚠️ CycleHealth: Module loaded but not functional");
        return false;
      }
      
      this.HealthKit = HealthKitModule;
      this.moduleAvailable = true;
      
      console.log("📦 @kingstinct/react-native-healthkit module loaded:", {
        hasModule: !!this.HealthKit,
        hasRequestAuth: typeof this.HealthKit?.requestAuthorization === "function",
        hasSaveCategory: typeof this.HealthKit?.saveCategorySample === "function",
      });

      return true;
    } catch (error: any) {
      this.moduleLoadError = error?.message || "Failed to load @kingstinct/react-native-healthkit";
      this.moduleAvailable = false;
      // Only log once, not as an error since this is expected in Expo Go
      console.log("⚠️ CycleHealth: HealthKit not available -", this.moduleLoadError);
      return false;
    }
  }

  /**
   * Check if the module is available
   */
  isAvailable(): boolean {
    if (Platform.OS !== "ios") return false;
    this.loadModule();
    return this.moduleAvailable && this.HealthKit !== null;
  }

  /**
   * Get module load error
   */
  getModuleError(): string | null {
    return this.moduleLoadError;
  }

  /**
   * Request authorization for cycle tracking data
   */
  async requestAuthorization(): Promise<boolean> {
    if (!this.loadModule()) {
      console.warn("CycleHealth: Module not available");
      return false;
    }

    try {
      // Request authorization for reproductive health data
      const { requestAuthorization } = this.HealthKit;
      
      if (!requestAuthorization) {
        console.warn("CycleHealth: requestAuthorization not available");
        return false;
      }

      await requestAuthorization({
        toRead: [
          "HKCategoryTypeIdentifierMenstrualFlow",
          "HKCategoryTypeIdentifierCervicalMucusQuality",
          "HKCategoryTypeIdentifierOvulationTestResult",
          "HKCategoryTypeIdentifierSexualActivity",
          "HKCategoryTypeIdentifierIntermenstrualBleeding",
        ],
        toShare: [
          "HKCategoryTypeIdentifierMenstrualFlow",
          "HKCategoryTypeIdentifierCervicalMucusQuality",
          "HKCategoryTypeIdentifierOvulationTestResult",
          "HKCategoryTypeIdentifierSexualActivity",
        ],
      });

      this.isAuthorized = true;
      console.log("✅ Cycle health authorization granted");
      return true;
    } catch (error: any) {
      console.error("❌ Failed to request cycle health authorization:", error);
      return false;
    }
  }

  /**
   * Check if authorized
   */
  getIsAuthorized(): boolean {
    return this.isAuthorized;
  }

  /**
   * Save menstrual flow to Apple Health
   */
  async saveMenstrualFlow(flow: PeriodFlow, date: Date = new Date()): Promise<boolean> {
    if (!this.isAvailable() || !this.HealthKit) return false;

    const hkValue = mapFlowToHealthKit(flow);
    if (hkValue === null) {
      console.log("CycleHealth: Not saving 'none' flow to HealthKit");
      return true; // Not an error, just nothing to save
    }

    try {
      const { saveCategorySample } = this.HealthKit;
      
      if (!saveCategorySample) {
        console.warn("CycleHealth: saveCategorySample not available");
        return false;
      }

      // Set start to beginning of day, end to end of day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      await saveCategorySample("HKCategoryTypeIdentifierMenstrualFlow", hkValue, {
        startDate: startOfDay,
        endDate: endOfDay,
        metadata: {
          HKMenstrualCycleStart: flow === "light" || flow === "medium" || flow === "heavy",
        },
      });

      logger.info("Apple Health sync: menstrual flow saved", { type: "menstrualFlow", flow, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ Failed to save menstrual flow:", error);
      return false;
    }
  }

  /**
   * Save cervical mucus quality to Apple Health
   */
  async saveCervicalMucus(mucus: CervicalMucus, date: Date = new Date()): Promise<boolean> {
    if (!this.isAvailable() || !this.HealthKit) return false;

    try {
      const { saveCategorySample } = this.HealthKit;
      
      if (!saveCategorySample) {
        console.warn("CycleHealth: saveCategorySample not available");
        return false;
      }

      const hkValue = mapMucusToHealthKit(mucus);

      await saveCategorySample("HKCategoryTypeIdentifierCervicalMucusQuality", hkValue, {
        startDate: date,
        endDate: date,
      });

      logger.info("Apple Health sync: cervical mucus saved", { type: "cervicalMucus", mucus, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ Failed to save cervical mucus:", error);
      return false;
    }
  }

  /**
   * Save ovulation test result to Apple Health
   */
  async saveOvulationTest(result: "positive" | "negative" | "not_taken", date: Date = new Date()): Promise<boolean> {
    if (!this.isAvailable() || !this.HealthKit) return false;

    const hkValue = mapOvulationToHealthKit(result);
    if (hkValue === null) {
      console.log("CycleHealth: Not saving 'not_taken' ovulation test to HealthKit");
      return true;
    }

    try {
      const { saveCategorySample } = this.HealthKit;
      
      if (!saveCategorySample) {
        console.warn("CycleHealth: saveCategorySample not available");
        return false;
      }

      await saveCategorySample("HKCategoryTypeIdentifierOvulationTestResult", hkValue, {
        startDate: date,
        endDate: date,
      });

      logger.info("Apple Health sync: ovulation test saved", { type: "ovulationTest", result, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ Failed to save ovulation test:", error);
      return false;
    }
  }

  /**
   * Save sexual activity to Apple Health
   */
  async saveSexualActivity(activity: SexualActivityType, date: Date = new Date()): Promise<boolean> {
    if (!this.isAvailable() || !this.HealthKit || !activity.hadActivity) return false;

    try {
      const { saveCategorySample } = this.HealthKit;
      
      if (!saveCategorySample) {
        console.warn("CycleHealth: saveCategorySample not available");
        return false;
      }

      // HKCategoryValueNotApplicable = 0 for sexual activity (it's just recorded, no value)
      await saveCategorySample("HKCategoryTypeIdentifierSexualActivity", 0, {
        startDate: date,
        endDate: date,
        metadata: activity.protected !== undefined ? {
          HKSexualActivityProtectionUsed: activity.protected,
        } : undefined,
      });

      logger.info("Apple Health sync: sexual activity saved", { type: "sexualActivity", protected: activity.protected, date: date.toISOString() });
      return true;
    } catch (error: any) {
      console.error("❌ Failed to save sexual activity:", error);
      return false;
    }
  }

  /**
   * Get menstrual flow for a specific date from Apple Health
   */
  async getMenstrualFlowForDate(date: Date): Promise<PeriodFlow | null> {
    if (!this.isAvailable() || !this.HealthKit) return null;

    try {
      const { queryCategorySamples } = this.HealthKit;
      
      if (!queryCategorySamples) {
        console.warn("CycleHealth: queryCategorySamples not available");
        return null;
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await queryCategorySamples("HKCategoryTypeIdentifierMenstrualFlow", {
        from: startOfDay,
        to: endOfDay,
        limit: 1,
      });

      if (result?.samples && result.samples.length > 0) {
        const sample = result.samples[0];
        return mapFlowFromHealthKit(sample.value);
      }

      return null;
    } catch (error: any) {
      console.error("❌ Failed to get menstrual flow:", error);
      return null;
    }
  }

  /**
   * Get cervical mucus for a specific date from Apple Health
   */
  async getCervicalMucusForDate(date: Date): Promise<CervicalMucus | null> {
    if (!this.isAvailable() || !this.HealthKit) return null;

    try {
      const { queryCategorySamples } = this.HealthKit;
      
      if (!queryCategorySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await queryCategorySamples("HKCategoryTypeIdentifierCervicalMucusQuality", {
        from: startOfDay,
        to: endOfDay,
        limit: 1,
      });

      if (result?.samples && result.samples.length > 0) {
        const sample = result.samples[0];
        return mapMucusFromHealthKit(sample.value);
      }

      return null;
    } catch (error: any) {
      console.error("❌ Failed to get cervical mucus:", error);
      return null;
    }
  }

  /**
   * Get ovulation test result for a specific date from Apple Health
   */
  async getOvulationTestForDate(date: Date): Promise<"positive" | "negative" | "not_taken" | null> {
    if (!this.isAvailable() || !this.HealthKit) return null;

    try {
      const { queryCategorySamples } = this.HealthKit;
      
      if (!queryCategorySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await queryCategorySamples("HKCategoryTypeIdentifierOvulationTestResult", {
        from: startOfDay,
        to: endOfDay,
        limit: 1,
      });

      if (result?.samples && result.samples.length > 0) {
        const sample = result.samples[0];
        // Map HealthKit values back to our app values
        switch (sample.value) {
          case HKCategoryValueOvulationTestResult.Negative:
            return "negative";
          case HKCategoryValueOvulationTestResult.LuteinizingHormoneSurge:
          case HKCategoryValueOvulationTestResult.EstrogenSurge:
            return "positive";
          default:
            return null;
        }
      }

      return null;
    } catch (error: any) {
      console.error("❌ Failed to get ovulation test:", error);
      return null;
    }
  }

  /**
   * Get sexual activity for a specific date from Apple Health
   */
  async getSexualActivityForDate(date: Date): Promise<SexualActivityType | null> {
    if (!this.isAvailable() || !this.HealthKit) return null;

    try {
      const { queryCategorySamples } = this.HealthKit;
      
      if (!queryCategorySamples) return null;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await queryCategorySamples("HKCategoryTypeIdentifierSexualActivity", {
        from: startOfDay,
        to: endOfDay,
        limit: 1,
      });

      if (result?.samples && result.samples.length > 0) {
        const sample = result.samples[0];
        return {
          hadActivity: true,
          protected: sample.metadata?.HKSexualActivityProtectionUsed as boolean | undefined,
        };
      }

      return null;
    } catch (error: any) {
      console.error("❌ Failed to get sexual activity:", error);
      return null;
    }
  }

  /**
   * Get all cycle data for a specific date from Apple Health
   */
  async getCycleDataForDate(date: Date): Promise<{
    periodFlow: PeriodFlow | null;
    cervicalMucus: CervicalMucus | null;
    ovulationTest: "positive" | "negative" | "not_taken" | null;
    sexualActivity: SexualActivityType | null;
  }> {
    // Run all queries in parallel for efficiency
    const [periodFlow, cervicalMucus, ovulationTest, sexualActivity] = await Promise.all([
      this.getMenstrualFlowForDate(date),
      this.getCervicalMucusForDate(date),
      this.getOvulationTestForDate(date),
      this.getSexualActivityForDate(date),
    ]);

    return {
      periodFlow,
      cervicalMucus,
      ovulationTest,
      sexualActivity,
    };
  }

  /**
   * Save all cycle data for a day to Apple Health
   */
  async saveCycleData(data: {
    periodFlow?: PeriodFlow;
    cervicalMucus?: CervicalMucus | null;
    ovulationTest?: "positive" | "negative" | "not_taken";
    sexualActivity?: SexualActivityType;
    date?: Date;
  }): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const date = data.date || new Date();

    // Ensure we're authorized
    if (!this.isAuthorized) {
      const authorized = await this.requestAuthorization();
      if (!authorized) {
        return { success: false, errors: ["Failed to get HealthKit authorization"] };
      }
    }

    // Save period flow
    if (data.periodFlow && data.periodFlow !== "none") {
      const flowResult = await this.saveMenstrualFlow(data.periodFlow, date);
      if (!flowResult) errors.push("Failed to save menstrual flow");
    }

    // Save cervical mucus
    if (data.cervicalMucus) {
      const mucusResult = await this.saveCervicalMucus(data.cervicalMucus, date);
      if (!mucusResult) errors.push("Failed to save cervical mucus");
    }

    // Save ovulation test
    if (data.ovulationTest && data.ovulationTest !== "not_taken") {
      const ovulationResult = await this.saveOvulationTest(data.ovulationTest, date);
      if (!ovulationResult) errors.push("Failed to save ovulation test");
    }

    // Save sexual activity
    if (data.sexualActivity?.hadActivity) {
      const sexResult = await this.saveSexualActivity(data.sexualActivity, date);
      if (!sexResult) errors.push("Failed to save sexual activity");
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const cycleHealthService = new CycleHealthService();
