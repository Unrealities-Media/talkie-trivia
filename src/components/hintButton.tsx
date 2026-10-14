import React, { useEffect } from "react"
import { Pressable, Text, StyleProp, ViewStyle, TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated"
import Ionicons from "@expo/vector-icons/Ionicons"
import { HintType } from "../models/game"
import { useStyles, Theme } from "../utils/hooks/useStyles"

type HintStatus = "available" | "used" | "disabled"

interface HintButtonProps {
  hintType: HintType
  iconName: keyof typeof Ionicons.glyphMap
  label: string
  onPress: (type: HintType) => void
  status: HintStatus
  accessibilityHintCount: number
  isHighlighted: boolean
}

const HintButton: React.FC<HintButtonProps> = ({
  hintType,
  iconName,
  label,
  onPress,
  status,
  accessibilityHintCount,
  isHighlighted,
}) => {
  const styles = useStyles(themedStyles)
  const highlightAnimation = useSharedValue(0)

  useEffect(() => {
    if (isHighlighted) {
      highlightAnimation.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        true
      )
    } else {
      highlightAnimation.value = withTiming(0)
    }
  }, [isHighlighted, highlightAnimation])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + highlightAnimation.value * 0.05 }],
      borderColor: isHighlighted
        ? styles.highlightedHintButton.borderColor
        : styles.hintButton.borderColor,
    }
  })

  const buttonStyle: StyleProp<ViewStyle> = [styles.hintButton]
  const textStyle: StyleProp<TextStyle> = [styles.buttonTextSmall]
  let iconColor = styles.buttonTextSmall.color

  if (status === "disabled") {
    buttonStyle.push(styles.disabled)
    textStyle.push(styles.disabledText)
    iconColor = styles.disabledText.color
  } else if (status === "used") {
    buttonStyle.push(styles.usedHintButton)
    textStyle.push(styles.usedText)
    iconColor = styles.usedText.color
  }

  if (isHighlighted) {
    buttonStyle.push(styles.highlightedHintButton)
    textStyle.push(styles.highlightedText)
    iconColor = styles.highlightedText.color
  }

  const getAccessibilityLabel = () => {
    switch (status) {
      case "used":
        return `Re-view the ${label.toLowerCase()} hint.`
      case "disabled":
        return `${label} hint unavailable.`
      case "available":
      default:
        return `Get the movie's ${label.toLowerCase()} hint. ${accessibilityHintCount} hints available.`
    }
  }

  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <Pressable
        style={buttonStyle}
        onPress={() => onPress(hintType)}
        disabled={status === "disabled"}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: status === "disabled" }}
        accessibilityLabel={getAccessibilityLabel()}
      >
        <Ionicons
          name={iconName}
          size={styles.icon.fontSize}
          color={iconColor}
        />
        <Text style={textStyle}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

interface HintButtonStyles {
  item: ViewStyle
  hintButton: ViewStyle
  usedHintButton: ViewStyle
  highlightedHintButton: ViewStyle
  disabled: ViewStyle
  icon: TextStyle
  buttonTextSmall: TextStyle
  disabledText: TextStyle
  usedText: TextStyle
  highlightedText: TextStyle
}

const themedStyles = (theme: Theme): HintButtonStyles => ({
  item: {
    maxWidth: "100%",
    flexShrink: 1,
  },
  hintButton: {
    borderRadius: theme.responsive.scale(4),
    padding: theme.responsive.scale(6),
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: theme.responsive.scale(4),
    marginVertical: theme.responsive.scale(8),
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  usedHintButton: {
    borderColor: theme.colors.tertiary,
  },
  highlightedHintButton: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    ...theme.shadows.medium,
    shadowColor: theme.colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: theme.responsive.scale(20),
  },
  buttonTextSmall: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.extraSmall,
  },
  disabledText: {
    color: theme.colors.textDisabled,
  },
  usedText: {
    color: theme.colors.accentText,
  },
  highlightedText: {
    color: theme.colors.accentText,
  },
})

export default HintButton
