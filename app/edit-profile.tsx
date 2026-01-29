import { account, getUserProfile, updateUserProfile } from "@/lib/appwrite";
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
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState("");
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      // Update password using Appwrite account
      await account.updatePassword(newPassword, currentPassword);
      
      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      Alert.alert("Success", "Password changed successfully");
    } catch (err: any) {
      console.error("Failed to change password:", err);
      const errorMessage = err?.message || "Failed to change password";
      Alert.alert("Error", errorMessage.includes("Invalid credentials") 
        ? "Current password is incorrect" 
        : errorMessage);
    } finally {
      setChangingPassword(false);
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

        {/* Change Password */}
        <View className="mt-6">
          <Text className="text-xs font-semibold text-gray-400 uppercase px-5 mb-2">
            Change Password
          </Text>
          <View className="bg-white px-5 py-4">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Current Password</Text>
              <View className="relative">
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry={!showCurrentPassword}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-12 text-base text-gray-900"
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-4 top-3.5"
                >
                  <Feather 
                    name={showCurrentPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </Pressable>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
              <View className="relative">
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry={!showNewPassword}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-12 text-base text-gray-900"
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-3.5"
                >
                  <Feather 
                    name={showNewPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </Pressable>
              </View>
              <Text className="text-xs text-gray-400 mt-1">
                Must be at least 8 characters
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Confirm New Password</Text>
              <View className="relative">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry={!showConfirmPassword}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-12 text-base text-gray-900"
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3.5"
                >
                  <Feather 
                    name={showConfirmPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className={`py-3 rounded-lg ${
                changingPassword || !currentPassword || !newPassword || !confirmPassword
                  ? "bg-gray-300"
                  : "bg-primary"
              }`}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Change Password
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
