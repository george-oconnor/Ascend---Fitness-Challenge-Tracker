import { Feather } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

type SwipeableActivityItemProps = {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
  timestamp: string;
  showBorder: boolean;
  onDelete: () => void;
};

export default function SwipeableActivityItem({
  icon,
  iconColor,
  iconBgColor,
  title,
  description,
  timestamp,
  showBorder,
  onDelete,
}: SwipeableActivityItemProps) {
  const renderRightActions = () => {
    return (
      <View className="justify-center bg-red-500 rounded-r-2xl">
        <View className="px-6 items-center justify-center h-full">
          <Feather name="trash-2" size={24} color="white" />
        </View>
      </View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === "right") {
          onDelete();
        }
      }}
      rightThreshold={40}
      overshootRight={false}
    >
      <View
        className={`flex-row items-center p-4 bg-white ${
          showBorder ? "border-b border-gray-100" : ""
        }`}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-full mr-3"
          style={{ backgroundColor: iconBgColor }}
        >
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{title}</Text>
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            {description}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">{timestamp}</Text>
      </View>
    </Swipeable>
  );
}
