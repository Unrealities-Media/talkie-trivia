import React, { useCallback, useMemo, useState, useEffect } from "react"
import { View, Pressable, ViewStyle, TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
  runOnJS,
} from "react-native-reanimated"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useAuth } from "../contexts/authContext"
import { FontAwesome } from "@expo/vector-icons"
import {
  DifficultyLevel,
  DIFFICULTY_MODES,
  DifficultyMode,
} from "../config/difficulty"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"

type Option = DifficultyMode & { value: DifficultyLevel }

const options: Option[] = (
  Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]
).map((key) => ({
  value: key,
  ...DIFFICULTY_MODES[key],
}))

const DifficultySelector = () => {
  const { player } = useAuth()
  const difficulty = useGameStore((state) => state.nextDifficulty)
  const setDifficulty = useGameStore((state) => state.setDifficulty)
  const styles = useStyles(themedStyles)

  const [hoveredDifficulty, setHoveredDifficulty] =
    useState<DifficultyLevel | null>(null)

  const handleSelect = useCallback(
    (newDifficulty: DifficultyLevel) => {
      if (player) {
        hapticsService.medium()
        setDifficulty(newDifficulty)
      }
    },
    [setDifficulty, player]
  )

  const descriptionToDisplay = useMemo(() => {
    const key = hoveredDifficulty || difficulty
    return options.find((o) => o.value === key)?.description || ""
  }, [hoveredDifficulty, difficulty])

  const [currentDescription, setCurrentDescription] =
    useState(descriptionToDisplay)
  const descriptionOpacity = useSharedValue(1)

  useEffect(() => {
    descriptionOpacity.value = withTiming(
      0,
      { duration: 150, easing: Easing.ease },
      (finished) => {
        if (finished) {
          runOnJS(setCurrentDescription)(descriptionToDisplay)
        }
      }
    )
  }, [descriptionToDisplay])

  useEffect(() => {
    descriptionOpacity.value = withTiming(1, {
      duration: 150,
      easing: Easing.ease,
    })
  }, [currentDescription])

  const animatedDescriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }))

  const handleLongPress = (value: DifficultyLevel) => {
    hapticsService.light()
    setHoveredDifficulty(value)
  }

  const selectedOptionLabel =
    options.find((o) => o.value === difficulty)?.label || "Medium"

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelContainer}>
          <FontAwesome
            name="gamepad"
            size={styles.icon.fontSize}
            color={styles.icon.color}
          />
          <Typography style={styles.title}>Next challenge difficulty</Typography>
        </View>
        <View style={styles.selectedOptionDisplay}>
          <Typography style={styles.selectedOptionTextDisplay}>
            {selectedOptionLabel}
          </Typography>
        </View>
      </View>

      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => handleSelect(option.value)}
            onLongPress={() => handleLongPress(option.value)}
            onPressOut={() => setHoveredDifficulty(null)}
            delayLongPress={200}
            style={({ pressed }) => [
              styles.option,
              difficulty === option.value && styles.selectedOption,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: difficulty === option.value }}
            accessibilityLabel={`Set next challenge difficulty to ${option.label}. ${option.description}`}
          >
            <Typography
              style={[
                styles.optionText,
                difficulty === option.value && styles.selectedOptionText,
              ]}
            >
              {option.label}
            </Typography>
          </Pressable>
        ))}
      </View>
      <Animated.View
        style={[styles.descriptionContainer, animatedDescriptionStyle]}
      >
        <Typography style={styles.descriptionText}>
          {currentDescription}
        </Typography>
      </Animated.View>
    </View>
  )
}

interface DifficultySelectorStyles {
  container: ViewStyle
  row: ViewStyle
  labelContainer: ViewStyle
  icon: TextStyle
  title: TextStyle
  selectedOptionDisplay: ViewStyle
  selectedOptionTextDisplay: TextStyle
  optionsContainer: ViewStyle
  option: ViewStyle
  selectedOption: ViewStyle
  optionText: TextStyle
  selectedOptionText: TextStyle
  descriptionContainer: ViewStyle
  descriptionText: TextStyle
}

const themedStyles = (theme: Theme): DifficultySelectorStyles => ({
  container: {
    width: "100%",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.textSecondary,
  },
  title: {
    fontFamily: "Arvo-Bold",
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.small,
  },
  selectedOptionDisplay: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.extraSmall,
    paddingHorizontal: theme.spacing.small,
    borderRadius: theme.responsive.scale(6),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedOptionTextDisplay: {
    fontFamily: "Arvo-Regular",
    fontSize: theme.responsive.responsiveFontSize(14),
    color: theme.colors.textSecondary,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.responsive.scale(6),
    marginTop: theme.spacing.extraSmall,
    padding: theme.spacing.extraSmall,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  option: {
    paddingVertical: theme.spacing.extraSmall,
    paddingHorizontal: theme.spacing.extraSmall,
    borderRadius: theme.responsive.scale(6),
    margin: theme.spacing.extraSmall,
    backgroundColor: theme.colors.surface,
  },
  selectedOption: {
    backgroundColor: theme.colors.primary,
  },
  optionText: {
    fontFamily: "Arvo-Regular",
    fontSize: theme.responsive.responsiveFontSize(14),
    color: theme.colors.textPrimary,
  },
  selectedOptionText: {
    fontFamily: "Arvo-Bold",
    color: theme.colors.onAccent,
  },
  descriptionContainer: {
    marginTop: theme.spacing.extraSmall,
    minHeight: theme.responsive.scale(60),
    paddingHorizontal: theme.spacing.extraSmall,
    justifyContent: "center",
  },
  descriptionText: {
    fontFamily: "Arvo-Regular",
    fontSize: theme.responsive.responsiveFontSize(12),
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: theme.responsive.responsiveFontSize(16),
  },
})

export default DifficultySelector
