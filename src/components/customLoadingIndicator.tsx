import React, { useEffect, useRef, useState } from "react"
import { View, ActivityIndicator, Animated, Easing, Platform, ViewStyle } from "react-native"
import { Svg, Circle } from "react-native-svg"
import { useStyles, Theme, useThemeTokens } from "../utils/hooks/useStyles"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

interface CustomLoadingIndicatorProps {
  isLowEndDevice?: boolean
}

const CustomLoadingIndicator: React.FC<CustomLoadingIndicatorProps> = ({
  isLowEndDevice = false,
}) => {
  const styles = useStyles(themedStyles)
  const theme = useThemeTokens()
  const { colors, responsive } = theme
  const reduced = usePremiereMotion()

  const useStandardIndicator = isLowEndDevice || Platform.OS === "web"
  const progress = useRef(new Animated.Value(0)).current
  const [isLaidOut, setIsLaidOut] = useState(false)
  const size = responsive.scale(50)
  const strokeWidth = responsive.scale(4)
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    if (useStandardIndicator || reduced || !isLaidOut) return

    progress.setValue(0)
    const rotation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }))
    rotation.start()
    return () => rotation.stop()
  }, [progress, useStandardIndicator, reduced, isLaidOut])

  const animatedStyle = {
    transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
  }

  if (useStandardIndicator && !reduced) {
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
      <Animated.View testID="loading-ring" onLayout={() => setIsLaidOut(true)} style={[styles.rotateContainer, animatedStyle]}>
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
