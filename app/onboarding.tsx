import { setHasSeenOnboarding } from "@/lib/onboarding";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
};

const SLIDES: Slide[] = [
  {
    key: "welcome",
    icon: "zap",
    iconBg: "#FFF1DE",
    iconColor: "#FE8C00",
    title: "Welcome to Ascend",
    description: "Your all-in-one companion for the 75 Hard Challenge — built to make the next 75 days easier to track and impossible to fake.",
  },
  {
    key: "track",
    icon: "check-square",
    iconBg: "#D1FAE5",
    iconColor: "#2F9B65",
    title: "Track every rule, every day",
    description: "Workouts, diet, water, reading, and your daily progress photo — all in one place, with streaks that keep you honest.",
  },
  {
    key: "sync",
    icon: "activity",
    iconBg: "#EDE9FE",
    iconColor: "#8B5CF6",
    title: "Synced from Apple Health",
    description: "Steps, workouts, sleep, and water fill in automatically from Apple Health, so most days log themselves.",
  },
  {
    key: "private",
    icon: "lock",
    iconBg: "#DBEAFE",
    iconColor: "#2563EB",
    title: "Private by design",
    description: "No accounts, no ads, no servers. Sign in with Apple, and your data lives only in your iCloud — we never see it.",
  },
];

export default function OnboardingScreen() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const isLastSlide = pageIndex === SLIDES.length - 1;

  const finishOnboarding = () => {
    setHasSeenOnboarding();
    router.replace("/auth");
  };

  const goToNext = () => {
    if (isLastSlide) {
      finishOnboarding();
      return;
    }
    scrollViewRef.current?.scrollTo({ x: (pageIndex + 1) * SCREEN_WIDTH, animated: true });
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPageIndex(index);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {!isLastSlide && (
        <Pressable className="absolute top-14 right-6 z-10 px-3 py-2" onPress={finishOnboarding} hitSlop={12}>
          <Text className="text-gray-100 font-quicksand-semibold">Skip</Text>
        </Pressable>
      )}

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {SLIDES.map((slide, index) => (
          <OnboardingSlide key={slide.key} slide={slide} index={index} scrollX={scrollX} isWelcome={index === 0} />
        ))}
      </Animated.ScrollView>

      <View className="px-8 pb-6">
        <View className="flex-row justify-center items-center mb-8">
          {SLIDES.map((slide, index) => {
            const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={slide.key}
                className="h-2 rounded-full bg-primary mx-1"
                style={{ width: dotWidth, opacity: dotOpacity }}
              />
            );
          })}
        </View>

        <Pressable
          className="bg-primary rounded-2xl py-4 items-center"
          onPress={goToNext}
          accessibilityRole="button"
        >
          <Text className="text-white font-quicksand-bold text-base">
            {isLastSlide ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function OnboardingSlide({
  slide,
  index,
  scrollX,
  isWelcome,
}: {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
  isWelcome: boolean;
}) {
  const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: "clamp" });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const translateY = scrollX.interpolate({ inputRange, outputRange: [24, 0, 24], extrapolate: "clamp" });

  return (
    <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-10">
      <Animated.View style={{ transform: [{ scale }], opacity }} className="items-center mb-10">
        {isWelcome ? (
          <View className="w-28 h-28 rounded-[32px] items-center justify-center mb-2 overflow-hidden" style={{ backgroundColor: slide.iconBg }}>
            <Image source={require("../assets/images/icon.png")} style={{ width: 72, height: 72, borderRadius: 18 }} resizeMode="contain" />
          </View>
        ) : (
          <View className="w-28 h-28 rounded-[32px] items-center justify-center" style={{ backgroundColor: slide.iconBg }}>
            <Feather name={slide.icon} size={48} color={slide.iconColor} />
          </View>
        )}
      </Animated.View>

      <Animated.View style={{ opacity, transform: [{ translateY }] }} className="items-center">
        <Text className="text-2xl font-quicksand-bold text-dark-100 text-center mb-3">{slide.title}</Text>
        <Text className="text-base font-quicksand text-gray-100 text-center leading-6">{slide.description}</Text>
      </Animated.View>
    </View>
  );
}
