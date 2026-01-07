import ChallengeStatusCard from "@/components/ChallengeStatusCard";
import Header from "@/components/Header";
import StepsCard from "@/components/StepsCard";
import { useChallengeStore } from "@/store/useChallengeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { user } = useSessionStore();
  const { fetchChallenge } = useChallengeStore();

  useEffect(() => {
    if (user?.id) {
      fetchChallenge(user.id);
    }
  }, [user?.id]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Header name={user?.name} />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Steps Card */}
          <StepsCard />
          
          {/* Challenge Status Card */}
          <ChallengeStatusCard />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
