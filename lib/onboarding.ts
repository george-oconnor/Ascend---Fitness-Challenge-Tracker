import AsyncStorage from "@react-native-async-storage/async-storage";

const HAS_SEEN_ONBOARDING_KEY = "hasSeenOnboarding";

export async function getHasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HAS_SEEN_ONBOARDING_KEY)) === "true";
  } catch {
    return true;
  }
}

export async function setHasSeenOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(HAS_SEEN_ONBOARDING_KEY, "true");
  } catch {
    // Non-fatal — worst case the user sees onboarding again next launch.
  }
}
