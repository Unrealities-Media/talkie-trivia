import React, { useEffect } from "react"
import { Text, View, ViewStyle, TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated"
import { useStyles, Theme } from "../utils/hooks/useStyles"

interface FlashMessageProps {
  message: string | null
  duration?: number
}

const FlashMessages: React.FC<FlashMessageProps> = ({
  message,
  duration = 3000,
}) => {
  const styles = useStyles(themedStyles)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (message) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.ease })
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300, easing: Easing.ease })
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  if (!message) return null

  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.container, animatedStyle]}>
      <View style={styles.shadowWrapper}>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </Animated.View>
  )
}

interface FlashMessageStyles {
  container: ViewStyle
  shadowWrapper: ViewStyle
  messageText: TextStyle
}

const themedStyles = (theme: Theme): FlashMessageStyles => ({
  container: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.large,
  },
  shadowWrapper: {
    backgroundColor: theme.colors.tertiary,
    borderRadius: theme.responsive.scale(8),
    ...theme.shadows.medium,
  },
  messageText: {
    color: theme.colors.onAccent,
    fontSize: theme.responsive.responsiveFontSize(16),
    fontFamily: "PremiereSans",
    textAlign: "center",
    paddingVertical: theme.spacing.small,
    paddingHorizontal: theme.spacing.medium,
  },
})

export default FlashMessages
