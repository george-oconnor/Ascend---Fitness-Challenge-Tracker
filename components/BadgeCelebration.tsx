import type { Badge } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface BadgeCelebrationProps {
  badge: Badge | null;
  visible: boolean;
  onDismiss: () => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  const colors = ["#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#3B82F6", "#EC4899"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = Math.random() * 8 + 6;

  useEffect(() => {
    const randomEndX = startX + (Math.random() - 0.5) * 150;
    
    scale.value = withDelay(delay, withSpring(1, { damping: 10 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT * 0.7, { duration: 2500, easing: Easing.out(Easing.quad) })
    );
    translateX.value = withDelay(
      delay,
      withTiming(randomEndX, { duration: 2500, easing: Easing.out(Easing.quad) })
    );
    rotate.value = withDelay(
      delay,
      withTiming(Math.random() * 720 - 360, { duration: 2500 })
    );
    opacity.value = withDelay(
      delay + 1500,
      withTiming(0, { duration: 1000 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: Math.random() > 0.5 ? size / 2 : 2,
        },
        animatedStyle,
      ]}
    />
  );
};

// Star burst component
const StarBurst = ({ delay }: { delay: number }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.2, { damping: 8 }),
        withTiming(0.8, { duration: 200 })
      )
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    rotation.value = withDelay(
      delay,
      withTiming(360, { duration: 2000, easing: Easing.linear })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.starBurst, animatedStyle]}>
      {[...Array(8)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.starRay,
            { transform: [{ rotate: `${i * 45}deg` }] },
          ]}
        />
      ))}
    </Animated.View>
  );
};

export function BadgeCelebration({ badge, visible, onDismiss }: BadgeCelebrationProps) {
  // Animation values
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.3);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(50);
  const badgeScale = useSharedValue(0);
  const badgeRotation = useSharedValue(-30);
  const titleOpacity = useSharedValue(0);
  const descriptionOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const shimmerPosition = useSharedValue(-1);
  
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerHaptics = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const startConfetti = useCallback(() => {
    setShowConfetti(true);
  }, []);

  useEffect(() => {
    if (visible && badge) {
      // Reset values
      backdropOpacity.value = 0;
      cardScale.value = 0.3;
      cardOpacity.value = 0;
      cardTranslateY.value = 50;
      badgeScale.value = 0;
      badgeRotation.value = -30;
      titleOpacity.value = 0;
      descriptionOpacity.value = 0;
      buttonOpacity.value = 0;
      shimmerPosition.value = -1;
      setShowConfetti(false);

      // Animate in sequence
      backdropOpacity.value = withTiming(1, { duration: 300 });
      
      cardScale.value = withDelay(100, withSpring(1, { damping: 12 }));
      cardOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
      cardTranslateY.value = withDelay(100, withSpring(0, { damping: 15 }));
      
      badgeScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 150 }));
      badgeRotation.value = withDelay(400, withSpring(0, { damping: 10 }));
      
      // Trigger haptics when badge appears
      setTimeout(() => runOnJS(triggerHaptics)(), 400);
      
      // Start confetti
      setTimeout(() => runOnJS(startConfetti)(), 500);
      
      titleOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
      descriptionOpacity.value = withDelay(800, withTiming(1, { duration: 300 }));
      buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 300 }));
      
      // Shimmer effect
      shimmerPosition.value = withDelay(
        1200,
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, badge]);

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    cardScale.value = withTiming(0.8, { duration: 200 });
    cardOpacity.value = withTiming(0, { duration: 200 });
    
    setTimeout(onDismiss, 200);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { translateY: cardTranslateY.value },
    ],
    opacity: cardOpacity.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: badgeScale.value },
      { rotate: `${badgeRotation.value}deg` },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerPosition.value,
          [-1, 1],
          [-SCREEN_WIDTH, SCREEN_WIDTH]
        ),
      },
    ],
  }));

  if (!badge) return null;

  // Generate confetti particles
  const confettiParticles = showConfetti
    ? [...Array(40)].map((_, i) => ({
        id: i,
        delay: Math.random() * 500,
        startX: Math.random() * SCREEN_WIDTH,
      }))
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Confetti */}
        {confettiParticles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            delay={particle.delay}
            startX={particle.startX}
          />
        ))}

        {/* Card */}
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Shimmer effect */}
          <Animated.View style={[styles.shimmer, shimmerStyle]} />

          {/* Star burst behind badge */}
          {showConfetti && <StarBurst delay={300} />}

          {/* Badge Icon */}
          <Animated.View
            style={[
              styles.badgeContainer,
              { backgroundColor: badge.bgColor },
              badgeStyle,
            ]}
          >
            <Feather
              name={badge.icon as keyof typeof Feather.glyphMap}
              size={48}
              color={badge.color}
            />
          </Animated.View>

          {/* Trophy emoji */}
          <Text style={styles.trophy}>🏆</Text>

          {/* Title */}
          <Animated.Text style={[styles.congratsText, titleStyle]}>
            Badge Earned!
          </Animated.Text>

          {/* Badge Name */}
          <Animated.Text style={[styles.badgeName, titleStyle]}>
            {badge.name}
          </Animated.Text>

          {/* Description */}
          <Animated.Text style={[styles.description, descriptionStyle]}>
            {badge.description}
          </Animated.Text>

          {/* Close Button */}
          <Animated.View style={buttonStyle}>
            <Pressable style={styles.button} onPress={handleClose}>
              <Text style={styles.buttonText}>Awesome!</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 100,
  },
  starBurst: {
    position: "absolute",
    top: 40,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  starRay: {
    position: "absolute",
    width: 4,
    height: 80,
    backgroundColor: "#FEF3C7",
    borderRadius: 2,
  },
  badgeContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  trophy: {
    fontSize: 32,
    marginBottom: 8,
  },
  congratsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8B5CF6",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
