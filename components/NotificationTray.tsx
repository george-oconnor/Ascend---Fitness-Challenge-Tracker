import {
    InAppNotification,
    useNotificationStore,
} from "@/store/useNotificationStore";
import { Feather } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useRef } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DROPDOWN_WIDTH = Math.min(SCREEN_WIDTH - 32, 360);
const MAX_HEIGHT = SCREEN_HEIGHT * 0.55;

// Icon mapping for notification types
const NOTIFICATION_ICONS: Record<
    string,
    { icon: keyof typeof Feather.glyphMap; defaultColor: string }
> = {
    badge_earned: { icon: "award", defaultColor: "#F59E0B" },
    day_complete: { icon: "check-circle", defaultColor: "#10B981" },
    step_goal: { icon: "trending-up", defaultColor: "#3B82F6" },
    workout_complete: { icon: "activity", defaultColor: "#8B5CF6" },
    streak: { icon: "zap", defaultColor: "#EF4444" },
    reminder: { icon: "bell", defaultColor: "#6B7280" },
    milestone: { icon: "flag", defaultColor: "#EC4899" },
};

interface NotificationItemProps {
    notification: InAppNotification;
    onPress: () => void;
    onDelete: () => void;
}

function NotificationItem({
    notification,
    onPress,
    onDelete,
}: NotificationItemProps) {
    const iconConfig =
        NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.reminder;
    const iconColor = notification.color || iconConfig.defaultColor;

    const timeAgo = formatDistanceToNow(notification.timestamp, {
        addSuffix: true,
    });

    return (
        <View className="flex-row items-start">
            <Pressable
                onPress={onPress}
                className={`flex-1 flex-row items-start p-3 ${
                    !notification.read ? "bg-purple-50/50" : "bg-white"
                }`}
            >
                {/* Icon */}
                <View
                    className="h-9 w-9 items-center justify-center rounded-full mr-3"
                    style={{ backgroundColor: `${iconColor}20` }}
                >
                    <Feather
                        name={
                            (notification.icon as keyof typeof Feather.glyphMap) ||
                            iconConfig.icon
                        }
                        size={16}
                        color={iconColor}
                    />
                </View>

                {/* Content */}
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text
                            className={`text-sm flex-1 ${
                                !notification.read ? "font-semibold" : "font-medium"
                            } text-gray-900`}
                            numberOfLines={1}
                        >
                            {notification.title}
                        </Text>
                        {!notification.read && (
                            <View className="h-2 w-2 rounded-full bg-purple-500 ml-2" />
                        )}
                    </View>
                    <Text className="text-xs text-gray-600 mt-0.5" numberOfLines={2}>
                        {notification.body}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-1">{timeAgo}</Text>
                </View>
            </Pressable>

            {/* Delete button */}
            <Pressable
                onPress={onDelete}
                className="p-3 justify-center items-center"
            >
                <Feather name="x" size={14} color="#9CA3AF" />
            </Pressable>
        </View>
    );
}

interface NotificationTrayProps {
    visible: boolean;
    onClose: () => void;
}

export function NotificationTray({ visible, onClose }: NotificationTrayProps) {
    const insets = useSafeAreaInsets();
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
    } = useNotificationStore();

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleNotificationPress = useCallback(
        (notification: InAppNotification) => {
            if (!notification.read) {
                markAsRead(notification.id);
            }
            // Could navigate based on notification.type here
        },
        [markAsRead]
    );

    const handleDelete = useCallback(
        (id: string) => {
            clearNotification(id);
        },
        [clearNotification]
    );

    // Position below the header (safe area + header padding + header content)
    const dropdownTop = insets.top + 60;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            {/* Transparent backdrop */}
            <Pressable
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.1)",
                }}
                onPress={onClose}
            />

            {/* Dropdown */}
            <Animated.View
                style={{
                    position: "absolute",
                    top: dropdownTop,
                    right: 16,
                    width: DROPDOWN_WIDTH,
                    maxHeight: MAX_HEIGHT,
                    backgroundColor: "white",
                    borderRadius: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    elevation: 12,
                    opacity: opacityAnim,
                    transform: [
                        { scale: scaleAnim },
                        {
                            translateY: scaleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-10, 0],
                            }),
                        },
                    ],
                    overflow: "hidden",
                }}
            >
                {/* Arrow pointer */}
                <View
                    style={{
                        position: "absolute",
                        top: -8,
                        right: 50,
                        width: 0,
                        height: 0,
                        borderLeftWidth: 8,
                        borderRightWidth: 8,
                        borderBottomWidth: 8,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderBottomColor: "white",
                        zIndex: 1,
                    }}
                />

                {/* Header */}
                <View className="p-3 border-b border-gray-100 bg-white">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Text className="text-base font-bold text-gray-900">
                                Notifications
                            </Text>
                            {unreadCount > 0 && (
                                <View className="ml-2 bg-purple-500 px-1.5 py-0.5 rounded-full">
                                    <Text className="text-[10px] font-semibold text-white">
                                        {unreadCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Pressable
                            onPress={onClose}
                            className="h-6 w-6 items-center justify-center rounded-full bg-gray-100"
                        >
                            <Feather name="x" size={14} color="#374151" />
                        </Pressable>
                    </View>

                    {/* Actions */}
                    {notifications.length > 0 && (
                        <View className="flex-row mt-2 gap-2">
                            {unreadCount > 0 && (
                                <Pressable
                                    onPress={markAllAsRead}
                                    className="flex-row items-center bg-gray-100 px-2 py-1 rounded-full"
                                >
                                    <Feather name="check" size={12} color="#6B7280" />
                                    <Text className="text-[10px] text-gray-600 ml-1">
                                        Mark all read
                                    </Text>
                                </Pressable>
                            )}
                            <Pressable
                                onPress={clearAllNotifications}
                                className="flex-row items-center bg-gray-100 px-2 py-1 rounded-full"
                            >
                                <Feather name="trash-2" size={12} color="#6B7280" />
                                <Text className="text-[10px] text-gray-600 ml-1">Clear all</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Notification List */}
                {notifications.length > 0 ? (
                    <ScrollView
                        style={{ maxHeight: MAX_HEIGHT - 80 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {notifications.map((notification, index) => (
                            <View
                                key={notification.id}
                                className={
                                    index < notifications.length - 1 ? "border-b border-gray-100" : ""
                                }
                            >
                                <NotificationItem
                                    notification={notification}
                                    onPress={() => handleNotificationPress(notification)}
                                    onDelete={() => handleDelete(notification.id)}
                                />
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <View className="items-center justify-center px-6 py-8">
                        <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-50 mb-3">
                            <Feather name="bell-off" size={24} color="#9CA3AF" />
                        </View>
                        <Text className="text-sm font-semibold text-gray-700 mb-1">
                            All caught up!
                        </Text>
                        <Text className="text-xs text-gray-500 text-center">
                            No notifications yet
                        </Text>
                    </View>
                )}
            </Animated.View>
        </Modal>
    );
}

// Bell icon with badge for use in header
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { unreadCount } = useNotificationStore();

  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm relative"
    >
      <Feather name="bell" size={18} color="#181C2E" />
      {unreadCount > 0 && (
        <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] items-center justify-center rounded-full bg-purple-500 px-1">
          <Text className="text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
