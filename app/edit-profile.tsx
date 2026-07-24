import { getUserProfile, updateUserProfile } from "@/lib/cloudkit";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditProfileScreen() {
  const { user } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState("");

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user?.id) return;
    
    setLoadingProfile(true);
    try {
      const profile = await getUserProfile(user.id);
      if (profile) {
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setEmail(profile.email || user.email || "");
        setProfileId(profile.$id || "");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Error", "First name and last name are required");
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(profileId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      
      Alert.alert("Success", "Profile updated successfully");
      router.back();
    } catch (err) {
      console.error("Failed to update profile:", err);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-200 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-orange-100 mr-3"
          >
            <Feather name="arrow-left" size={20} color="#F97316" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
        </View>
        <Pressable 
          onPress={handleSaveProfile}
          disabled={loading}
          className="px-4 py-2 bg-primary rounded-lg"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white font-semibold">Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Information */}
        <View className="mt-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">
            Profile Information
          </Text>
          <View className="bg-white px-5 py-4">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">First Name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                autoCapitalize="words"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Last Name</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900"
                autoCapitalize="words"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
              <TextInput
                value={email}
                editable={false}
                className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-500"
              />
              <Text className="text-xs text-gray-400 mt-1">Email cannot be changed</Text>
            </View>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
