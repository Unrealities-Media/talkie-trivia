import React, { useEffect } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated"
import { hapticsService } from "../utils/hapticsService"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { Button } from "./ui/button"

interface TutorialTooltipProps {
  isVisible: boolean
  text: string
  onDismiss: () => void
  style?: object
}

const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  isVisible,
  text,
  onDismiss,
  style,
}) => {
  const styles = useStyles(themedStyles)
  const animation = useSharedValue(0)

  useEffect(() => {
    animation.value = withTiming(isVisible ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    })
  }, [isVisible, animation])

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
    transform: [{ translateY: interpolate(animation.value, [0, 1], [10, 0]) }],
  }))

  const handleDismiss = () => {
    hapticsService.medium()
    onDismiss()
  }

  if (!isVisible) return null

  return (
    <Animated.View style={[styles.container, animatedContainerStyle, style]}>
      <View style={styles.tooltipBox}>
        <Typography style={styles.text}>{text}</Typography>
        <Button
          title="Got it"
          onPress={handleDismiss}
          size="sm"
          variant="primary"
          style={{ alignSelf: "center" }}
        />
      </View>
    </Animated.View>
  )
}

interface TutorialTooltipStyles {
  container: ViewStyle
  tooltipBox: ViewStyle
  text: TextStyle
}

const themedStyles = (theme: Theme): TutorialTooltipStyles => ({
  container: {
    marginVertical: theme.spacing.small,
    alignItems: "center",
    width: "90%",
    alignSelf: "center",
    ...theme.shadows.medium,
  },
  tooltipBox: {
    backgroundColor: theme.colors.tertiary,
    borderRadius: theme.responsive.scale(8),
    padding: theme.spacing.medium,
    width: "100%",
  },
  text: {
    fontFamily: "Arvo-Regular",
    fontSize: theme.responsive.responsiveFontSize(15),
    color: theme.colors.onAccent,
    lineHeight: theme.responsive.responsiveFontSize(21),
    textAlign: "center",
    marginBottom: theme.spacing.medium,
  },
})

export default TutorialTooltip
