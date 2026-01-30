import type { Badge } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface BadgeCelebrationProps {
  badge: Badge | null;
  visible: boolean;
  onDismiss: () => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0)).current;

  const colors = ["#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#3B82F6", "#EC4899"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = Math.random() * 8 + 6;

  useEffect(() => {
    const randomEndX = startX + (Math.random() - 0.5) * 150;
    
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT * 0.7,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: randomEndX,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: Math.random() * 720 - 360,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

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
        {
          transform: [
            { translateX },
            { translateY },
            { rotate: rotate.interpolate({
              inputRange: [0, 360],
              outputRange: ['0deg', '360deg']
            }) },
            { scale },
          ],
          opacity,
        },
      ]}
    />
  );
};

// Star burst component
const StarBurst = ({ delay }: { delay: number }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scale, { toValue: 1.2, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotation, {
          toValue: 360,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.starBurst, {
      transform: [
        { scale },
        { rotate: rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg']
        }) }
      ],
      opacity,
    }]}>
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
  // Animation values using React Native Animated
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotation = useRef(new Animated.Value(-30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const descriptionOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const shimmerPosition = useRef(new Animated.Value(-1)).current;
  
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerHaptics = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const startConfetti = useCallback(() => {
    // Use requestAnimationFrame to ensure confetti starts smoothly
    requestAnimationFrame(() => {
      setShowConfetti(true);
    });
  }, []);

  useEffect(() => {
    if (visible && badge) {
      // Reset values
      backdropOpacity.setValue(0);
      cardScale.setValue(0.3);
      cardOpacity.setValue(0);
      cardTranslateY.setValue(50);
      badgeScale.setValue(0);
      badgeRotation.setValue(-30);
      titleOpacity.setValue(0);
      descriptionOpacity.setValue(0);
      buttonOpacity.setValue(0);
      shimmerPosition.setValue(-1);
      setShowConfetti(false);

      // Animate in sequence
      const animations = [
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(cardScale, { toValue: 1, useNativeDriver: true }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(cardTranslateY, { toValue: 0, useNativeDriver: true }),
        ]),
        Animated.delay(300),
        Animated.parallel([
          Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(badgeRotation, { toValue: 0, useNativeDriver: true }),
        ]),
        Animated.delay(200),
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(descriptionOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(shimmerPosition, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ];

      // Trigger haptics when badge appears
      const hapticsTimer = setTimeout(triggerHaptics, 400);
      
      // Start confetti - defer to avoid blocking main thread
      const confettiTimer = setTimeout(startConfetti, 500);
      
      // Start animations
      Animated.sequence(animations).start();
      
      // Cleanup timers on unmount
      return () => {
        clearTimeout(hapticsTimer);
        clearTimeout(confettiTimer);
      };
    }
  }, [visible, badge]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const backdropStyle = {
    opacity: backdropOpacity,
  };

  const cardStyle = {
    transform: [
      { scale: cardScale },
      { translateY: cardTranslateY },
    ],
    opacity: cardOpacity,
  };

  const badgeStyle = {
    transform: [
      { scale: badgeScale },
      { rotate: badgeRotation.interpolate({
        inputRange: [-30, 0],
        outputRange: ['-30deg', '0deg']
      }) },
    ],
  };

  const titleStyle = {
    opacity: titleOpacity,
  };

  const descriptionStyle = {
    opacity: descriptionOpacity,
  };

  const buttonStyle = {
    opacity: buttonOpacity,
  };

  const shimmerStyle = {
    transform: [
      {
        translateX: shimmerPosition.interpolate({
          inputRange: [-1, 1],
          outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH]
        }),
      },
    ],
  };

  if (!badge) return null;

  // Generate confetti particles - memoized and reduced count for better performance
  const confettiParticles = useMemo(() => 
    showConfetti
      ? [...Array(25)].map((_, i) => ({
          id: i,
          delay: Math.random() * 500,
          startX: Math.random() * SCREEN_WIDTH,
        }))
      : [],
    [showConfetti]
  );

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
