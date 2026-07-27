import { StravaLogo } from "@/components/StravaLogo";
import { useStravaStore } from "@/store/useStravaStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StravaSettingsScreen() {
  const {
    isConnected,
    isConnecting,
    isSyncing,
    syncToAppleHealth,
    checkConnection,
    connect,
    disconnect,
    syncNow,
    setSyncToAppleHealth,
  } = useStravaStore();

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = async () => {
    const ok = await connect();
    if (!ok) {
      const error = useStravaStore.getState().error;
      if (error) Alert.alert("Couldn't connect Strava", error);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Strava",
      "Ascend will stop pulling new workouts directly from Strava. Previously imported workouts stay in your history.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => disconnect() },
      ]
    );
  };

  const handleSync = async () => {
    await syncNow();
    const error = useStravaStore.getState().error;
    if (error) Alert.alert("Sync failed", error);
  };

  return (
    <SafeAreaView className="flex-1 bg-orange-50" edges={["top"]}>
      <View className="bg-white px-5 py-4 border-b border-orange-100 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-orange-100 mr-3"
        >
          <Feather name="arrow-left" size={20} color="#F97316" />
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Strava</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="items-center mt-8 mb-2">
          <StravaLogo height={40} />
        </View>

        <View className="mt-6">
          <View className="bg-white rounded-xl overflow-hidden mx-4">
            <View className="flex-row items-center bg-white px-4 py-3.5 border-b border-gray-100">
              <View className="flex-1">
                <Text className="text-base text-gray-900">Connected</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isConnected
                    ? "Workouts sync directly with their correct type"
                    : "Connect to import workouts with their correct type"}
                </Text>
              </View>
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FC5200" />
              ) : (
                <Switch
                  value={isConnected}
                  onValueChange={(value) => (value ? handleConnect() : handleDisconnect())}
                  trackColor={{ false: "#D1D5DB", true: "#FDBA95" }}
                  thumbColor={isConnected ? "#FC5200" : "#F3F4F6"}
                />
              )}
            </View>

            {isConnected && (
              <>
                <Pressable
                  onPress={handleSync}
                  disabled={isSyncing}
                  className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-lg mr-3" style={{ backgroundColor: "#F3F4F6" }}>
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <Feather name="refresh-cw" size={17} color="#6B7280" />
                    )}
                  </View>
                  <Text className="flex-1 text-base text-gray-900">
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </Text>
                </Pressable>

                <View className="flex-row items-center px-4 py-3.5">
                  <View className="flex-1 mr-3">
                    <Text className="text-base text-gray-900">Also sync to Apple Health</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Write Strava workouts into Apple Health too, using the correct type
                    </Text>
                  </View>
                  <Switch
                    value={syncToAppleHealth}
                    onValueChange={setSyncToAppleHealth}
                    trackColor={{ false: "#D1D5DB", true: "#FDBA95" }}
                    thumbColor={syncToAppleHealth ? "#FC5200" : "#F3F4F6"}
                  />
                </View>
              </>
            )}
          </View>

          {isConnected && (
            <Text className="text-xs text-gray-400 px-8 mt-3 leading-5">
              If Strava&apos;s own Apple Health sync is also turned on, leave this off to avoid
              double-writing the same workout — Ascend already reads Strava&apos;s activities directly.
              Turn this on if you&apos;ve disabled Strava&apos;s native Health sync and want Ascend to be
              the one writing your Strava workouts into Apple Health instead, with the correct type.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
