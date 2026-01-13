import { useChallengeStore } from "@/store/useChallengeStore";
import { DailyLog } from "@/types/type.d";
import { Feather } from "@expo/vector-icons";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_PADDING * 4); // Account for screen padding

type GraphType = "mood" | "sleep" | "water" | "steps";

interface GraphConfig {
  type: GraphType;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bgColor: string;
  dataKey: keyof DailyLog;
  formatValue: (value: number) => string;
  getMaxValue: () => number;
}

const GRAPH_CONFIGS: GraphConfig[] = [
  {
    type: "mood",
    title: "Mood Trends",
    icon: "smile",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    dataKey: "moodScore",
    formatValue: (value: number) => {
      const labels = ["", "Struggling", "Down", "Okay", "Good", "Great"];
      return labels[value] || "";
    },
    getMaxValue: () => 5,
  },
  {
    type: "steps",
    title: "Steps Progress",
    icon: "activity",
    color: "#10B981",
    bgColor: "#D1FAE5",
    dataKey: "stepsCount",
    formatValue: (value: number) => value.toLocaleString(),
    getMaxValue: () => 15000,
  },
];

// Mood icon mapping (matching log-mood.tsx)
const MOOD_ICONS: Record<number, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  1: { icon: "frown", color: "#EF4444" },
  2: { icon: "meh", color: "#F97316" },
  3: { icon: "minus", color: "#EAB308" },
  4: { icon: "smile", color: "#22C55E" },
  5: { icon: "sun", color: "#10B981" },
};

// Line chart component for mood
function MoodChart({ data, color }: { data: { date: Date; value: number | undefined }[]; color: string }) {
  const chartWidth = CARD_WIDTH - 40;
  const chartHeight = 180;
  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  
  const validData = data.filter(d => d.value !== undefined && d.value > 0) as { date: Date; value: number }[];
  
  if (validData.length === 0) {
    return (
      <View style={{ height: chartHeight, justifyContent: "center", alignItems: "center" }}>
        <Feather name="bar-chart" size={48} color="#D1D5DB" />
        <Text className="text-gray-400 mt-3">No mood data yet</Text>
        <Text className="text-gray-400 text-sm mt-1">Start logging your mood to see trends!</Text>
      </View>
    );
  }
  
  const maxValue = 5;
  const minValue = 1;
  
  // Calculate dimensions
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const stepX = graphWidth / (data.length - 1);
  
  // Create path for line
  const points = data.map((d, i) => {
    const x = padding.left + (i * stepX);
    const y = d.value !== undefined && d.value > 0
      ? padding.top + graphHeight - ((d.value - minValue) / (maxValue - minValue)) * graphHeight
      : -100; // Off screen if no data
    return { x, y, value: d.value, date: d.date };
  });
  
  // Create SVG path
  const validPoints = points.filter(p => p.value !== undefined && p.value > 0);
  if (validPoints.length === 0) {
    return (
      <View style={{ height: chartHeight, justifyContent: "center", alignItems: "center" }}>
        <Feather name="bar-chart" size={48} color="#D1D5DB" />
        <Text className="text-gray-400 mt-3">No mood data yet</Text>
      </View>
    );
  }
  
  const linePath = validPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  
  // Create area path (for gradient fill)
  const areaPath = validPoints.length > 0
    ? `${linePath} L ${validPoints[validPoints.length - 1].x} ${padding.top + graphHeight} L ${validPoints[0].x} ${padding.top + graphHeight} Z`
    : "";
  
  return (
    <View style={{ position: 'relative' }}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Area fill */}
        {areaPath && (
          <Path
            d={areaPath}
            fill={color}
            opacity={0.1}
          />
        )}
        
        {/* Line */}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* X-axis labels (dates) */}
        {points.map((point, i) => {
          if (i % 2 !== 0 && i !== points.length - 1) return null; // Show every other label
          return (
            <SvgText
              key={`label-${i}`}
              x={point.x}
              y={chartHeight - 10}
              fill="#9CA3AF"
              fontSize="10"
              textAnchor="middle"
            >
              {format(point.date, "MMM d")}
            </SvgText>
          );
        })}
      </Svg>
      
      {/* Data points as mood icons */}
      {points.map((point, i) => {
        if (point.value === undefined || point.value === 0) return null;
        const iconConfig = MOOD_ICONS[point.value];
        return (
          <View
            key={`icon-point-${i}`}
            style={{
              position: 'absolute',
              left: point.x - 12,
              top: point.y - 12,
              backgroundColor: 'white',
              borderRadius: 12,
              width: 24,
              height: 24,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: iconConfig.color,
            }}
          >
            <Feather name={iconConfig.icon} size={14} color={iconConfig.color} />
          </View>
        );
      })}
    </View>
  );
}

// Bar chart component for steps
function StepsChart({ data, color, goalSteps }: { data: { date: Date; value: number | undefined }[]; color: string; goalSteps: number }) {
  const chartWidth = CARD_WIDTH - 40;
  const chartHeight = 180;
  const padding = { top: 20, right: 10, bottom: 30, left: 35 };
  
  const validData = data.filter(d => d.value !== undefined && d.value > 0) as { date: Date; value: number }[];
  
  if (validData.length === 0) {
    return (
      <View style={{ height: chartHeight, justifyContent: "center", alignItems: "center" }}>
        <Feather name="activity" size={48} color="#D1D5DB" />
        <Text className="text-gray-400 mt-3">No steps data yet</Text>
        <Text className="text-gray-400 text-sm mt-1">Start tracking to see your progress!</Text>
      </View>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d.value || 0), goalSteps);
  
  // Calculate dimensions
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = graphWidth / data.length - 8;
  const barSpacing = 8;
  
  return (
    <View>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Goal line */}
        {goalSteps > 0 && (() => {
          const goalY = padding.top + graphHeight - (goalSteps / maxValue) * graphHeight;
          return (
            <>
              <Line
                x1={padding.left}
                y1={goalY}
                x2={chartWidth - padding.right}
                y2={goalY}
                stroke="#6366F1"
                strokeWidth="2"
                strokeDasharray="6,4"
              />
              <SvgText
                x={padding.left - 5}
                y={goalY - 5}
                fill="#6366F1"
                fontSize="10"
                textAnchor="end"
              >
                Goal
              </SvgText>
            </>
          );
        })()}
        
        {/* Bars */}
        {data.map((d, i) => {
          if (d.value === undefined || d.value === 0) return null;
          const barHeight = (d.value / maxValue) * graphHeight;
          const x = padding.left + (i * (barWidth + barSpacing));
          const y = padding.top + graphHeight - barHeight;
          const metGoal = d.value >= goalSteps;
          
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={metGoal ? color : "#D1D5DB"}
              rx={4}
            />
          );
        })}
        
        {/* X-axis labels (dates) */}
        {data.map((d, i) => {
          if (i % 2 !== 0 && i !== data.length - 1) return null;
          const x = padding.left + (i * (barWidth + barSpacing)) + barWidth / 2;
          return (
            <SvgText
              key={`label-${i}`}
              x={x}
              y={chartHeight - 10}
              fill="#9CA3AF"
              fontSize="10"
              textAnchor="middle"
            >
              {format(d.date, "MMM d")}
            </SvgText>
          );
        })}
        
        {/* Y-axis labels */}
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(maxValue * fraction);
          const y = padding.top + graphHeight - (fraction * graphHeight);
          return (
            <SvgText
              key={`y-${fraction}`}
              x={padding.left - 8}
              y={y + 4}
              fill="#9CA3AF"
              fontSize="10"
              textAnchor="end"
            >
              {(value / 1000).toFixed(0)}k
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

export default function SwipeableGraphCard() {
  const { allLogs, challenge } = useChallengeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Show all graphs regardless of tracking status
  const availableGraphs = GRAPH_CONFIGS;
  
  if (availableGraphs.length === 0) {
    return null; // Don't show if no graphs available
  }
  
  const currentGraph = availableGraphs[currentIndex];
  
  // Get last 7 days of data for a specific graph
  const getLast7DaysData = (graph: GraphConfig) => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });
    
    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const log = allLogs?.find((l: DailyLog) => format(parseISO(l.date), "yyyy-MM-dd") === dateStr);
      const value = log?.[graph.dataKey] as number | undefined;
      
      return {
        date,
        value,
      };
    });
  };
  
  const data = getLast7DaysData(currentGraph);
  
  // Calculate stats for current graph
  const validValues = data.filter(d => d.value !== undefined && d.value > 0).map(d => d.value!);
  const average = validValues.length > 0
    ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
    : 0;
  const trend = validValues.length >= 2
    ? validValues[validValues.length - 1] - validValues[0]
    : 0;
  
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setCurrentIndex(index);
  };
  
  const scrollToGraph = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * CARD_WIDTH, animated: true });
    setCurrentIndex(index);
  };
  
  return (
    <View className="mt-4 mb-6">
      <View className="flex-row items-center justify-between px-1 mb-3">
        <Text className="text-sm font-semibold text-gray-600">Analytics</Text>
        {availableGraphs.length > 1 && (
          <View className="flex-row">
            {availableGraphs.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => scrollToGraph(index)}
                className={`h-2 rounded-full mx-1 ${
                  index === currentIndex ? "bg-purple-500 w-6" : "bg-gray-300 w-2"
                }`}
              />
            ))}
          </View>
        )}
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 4 }}
      >
        {availableGraphs.map((graph, index) => {
          const graphData = getLast7DaysData(graph);
          const graphValidValues = graphData.filter(d => d.value !== undefined && d.value > 0).map(d => d.value!);
          const graphAverage = graphValidValues.length > 0
            ? graphValidValues.reduce((sum, val) => sum + val, 0) / graphValidValues.length
            : 0;
          const graphTrend = graphValidValues.length >= 2
            ? graphValidValues[graphValidValues.length - 1] - graphValidValues[0]
            : 0;
          
          return (
            <View
              key={graph.type}
              style={{ width: CARD_WIDTH }}
              className="bg-white rounded-2xl p-5 shadow-sm mr-3"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View
                    className="h-10 w-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: graph.bgColor }}
                  >
                    <Feather name={graph.icon} size={20} color={graph.color} />
                  </View>
                  <View className="ml-3">
                    <Text className="text-base font-bold text-gray-900">{graph.title}</Text>
                    <Text className="text-xs text-gray-500">Last 7 days</Text>
                  </View>
                </View>
              </View>
              
              {/* Chart */}
              {index === currentIndex && graph.type === "mood" && (
                <MoodChart data={graphData} color={graph.color} />
              )}
              {index === currentIndex && graph.type === "steps" && (
                <StepsChart 
                  data={graphData} 
                  color={graph.color} 
                  goalSteps={challenge?.stepsGoal || 10000}
                />
              )}
              
              {/* Stats */}
              <View className="flex-row mt-4 pt-4 border-t border-gray-100">
                <View className="flex-1 items-center">
                  <Text className="text-xs text-gray-500 mb-1">Average</Text>
                  <Text className="text-lg font-bold text-gray-800">
                    {graphAverage > 0 ? (graph.type === "steps" ? Math.round(graphAverage).toLocaleString() : graphAverage.toFixed(1)) : "--"}
                  </Text>
                </View>
                <View className="flex-1 items-center border-l border-gray-100">
                  <Text className="text-xs text-gray-500 mb-1">Trend</Text>
                  <View className="flex-row items-center">
                    {graphTrend > 0 && <Feather name="trending-up" size={16} color="#10B981" />}
                    {graphTrend < 0 && <Feather name="trending-down" size={16} color="#EF4444" />}
                    {graphTrend === 0 && <Feather name="minus" size={16} color="#9CA3AF" />}
                    <Text
                      className={`text-lg font-bold ml-1 ${
                        graphTrend > 0 ? "text-green-600" : graphTrend < 0 ? "text-red-600" : "text-gray-500"
                      }`}
                    >
                      {graphTrend > 0 ? "+" : ""}{graphTrend !== 0 ? (graph.type === "steps" ? Math.round(graphTrend).toLocaleString() : graphTrend.toFixed(1)) : "--"}
                    </Text>
                  </View>
                </View>
                <View className="flex-1 items-center border-l border-gray-100">
                  <Text className="text-xs text-gray-500 mb-1">Logged</Text>
                  <Text className="text-lg font-bold text-gray-800">
                    {graphValidValues.length}/7
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
