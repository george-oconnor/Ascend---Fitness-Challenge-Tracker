import { useChallengeStore } from "@/store/useChallengeStore";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LogPhotoScreen() {
  const router = useRouter();
  const { challenge, todayLog, updateProgress } = useChallengeStore();
  const [photoTaken, setPhotoTaken] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing data
  useEffect(() => {
    if (todayLog?.progressPhotoCompleted !== undefined) {
      setPhotoTaken(todayLog.progressPhotoCompleted);
    }
  }, [todayLog?.progressPhotoCompleted]);

  if (!challenge || !todayLog) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const photoDays = (challenge as any).progressPhotoDays ?? 1;
  const frequencyText = photoDays === 1 ? "daily" : `every ${photoDays} days`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProgress({
        progressPhotoCompleted: photoTaken,
      });
      router.back();
    } catch (err) {
      console.error("Failed to save photo status:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePhoto = () => {
    setPhotoTaken(!photoTaken);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Feather name="arrow-left" size={24} color="#181C2E" />
        </Pressable>
        <Text className="text-lg font-bold text-gray-900">Progress Photo</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View className="flex-1 px-4 py-8">
        {/* Icon and Title */}
        <View className="items-center mb-8">
          <View className="h-24 w-24 rounded-full bg-pink-100 items-center justify-center mb-4">
            <Feather name="camera" size={48} color="#EC4899" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2">Progress Photo</Text>
          <Text className="text-base text-gray-600 text-center">
            Did you take a progress photo today?
          </Text>
        </View>

        {/* Photo Status Card */}
        <Pressable
          onPress={handleTogglePhoto}
          className={`rounded-2xl p-6 mb-8 ${photoTaken ? "bg-pink-50 border-2 border-pink-500" : "bg-white border-2 border-gray-200"}`}
        >
          <View className="flex-row items-center">
            <View className={`h-12 w-12 rounded-full items-center justify-center mr-4 ${photoTaken ? "bg-pink-500" : "bg-gray-100"}`}>
              {photoTaken ? (
                <Feather name="check" size={24} color="white" />
              ) : (
                <Feather name="camera" size={24} color="#9CA3AF" />
              )}
            </View>
            <View className="flex-1">
              <Text className={`text-lg font-bold ${photoTaken ? "text-pink-700" : "text-gray-800"}`}>
                {photoTaken ? "Photo Taken" : "Take a Photo"}
              </Text>
              <Text className="text-sm text-gray-600 mt-1">
                {photoTaken ? "You took today's progress photo" : "Tap to mark as done"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Tips */}
        <View className="bg-gray-50 rounded-xl p-4">
          <Text className="text-sm font-semibold text-gray-800 mb-3">💡 Tips for Best Results</Text>
          <View className="space-y-2">
            <View className="flex-row items-start">
              <Text className="text-gray-600 mr-2">•</Text>
              <Text className="text-sm text-gray-600 flex-1">Same time of day (morning is best)</Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-gray-600 mr-2">•</Text>
              <Text className="text-sm text-gray-600 flex-1">Same location with consistent lighting</Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-gray-600 mr-2">•</Text>
              <Text className="text-sm text-gray-600 flex-1">Same clothing or minimal clothing for comparison</Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-gray-600 mr-2">•</Text>
              <Text className="text-sm text-gray-600 flex-1">Use different angles for better tracking</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Save Button */}
      <View className="px-4 py-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`py-4 rounded-xl items-center ${photoTaken ? "bg-pink-500" : "bg-gray-200"}`}
        >
          <Text className={`text-base font-semibold ${photoTaken ? "text-white" : "text-gray-400"}`}>
            {saving ? "Saving..." : "Confirm"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
