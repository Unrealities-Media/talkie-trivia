import React, { useEffect } from "react"
import { View, ActivityIndicator, Platform, ViewStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated"
import { Svg, Circle } from "react-native-svg"
import { useStyles, Theme, useThemeTokens } from "../utils/hooks/useStyles"

interface CustomLoadingIndicatorProps {
  isLowEndDevice?: boolean
}

const CustomLoadingIndicator: React.FC<CustomLoadingIndicatorProps> = ({
  isLowEndDevice = false,
}) => {
  const styles = useStyles(themedStyles)
  const theme = useThemeTokens()
  const { colors, responsive } = theme

  const useStandardIndicator = isLowEndDevice || Platform.OS === "web"
  const progress = useSharedValue(0)
  const size = responsive.scale(50)
  const strokeWidth = responsive.scale(4)
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    if (useStandardIndicator) return

    progress.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    )
    return () => cancelAnimation(progress)
  }, [progress, useStandardIndicator])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 360}deg` }],
    }
  })

  if (useStandardIndicator) {
    return (
      <ActivityIndicator
        size="large"
        color={colors.primary}
        testID="standard-activity-indicator"
      />
    )
  }

  return (
    <View
      style={styles.rotateContainer}
      testID="activity-indicator"
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
    >
      <Animated.View style={[styles.rotateContainer, animatedStyle]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.tertiary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.75}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  )
}

interface CustomLoadingIndicatorStyles {
  rotateContainer: ViewStyle
}

const themedStyles = (theme: Theme): CustomLoadingIndicatorStyles => ({
  rotateContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
})

export default CustomLoadingIndicator
