import { useEffect } from "react"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  cancelAnimation,
} from "react-native-reanimated"
import { usePremiereMotion } from "./usePremiereMotion"
import { Theme } from "./useStyles"
import { HintInfo } from "../../models/game"

type GuessResult = {
  itemId: number | string
  correct: boolean
  feedback?: string | null
  hintInfo?: HintInfo[] | null
} | null

interface UseGuessAnimationProps {
  isCorrect: boolean
  isLastGuess: boolean
  lastGuessResult: GuessResult
  theme: Theme
}

/**
 * A custom hook to manage the complex animation sequences for a guess row.
 * It encapsulates all `react-native-reanimated` logic, cleaning up the component.
 *
 * @param {UseGuessAnimationProps} props - The props required to determine the animation logic.
 * @returns An object containing the memoized animated styles for the component to use.
 */
export const useGuessAnimation = ({
  isCorrect,
  isLastGuess,
  lastGuessResult,
  theme,
}: UseGuessAnimationProps) => {
  const { colors } = theme
  const reduced = usePremiereMotion()

  // --- Shared Values for Animations ---
  const rotate = useSharedValue(0)
  const shakeX = useSharedValue(0)
  const backgroundColor = useSharedValue(theme.colors.surface)
  const feedbackAnim = useSharedValue(0)

  // --- Animation Trigger Effect ---
  useEffect(() => {
    // Reveal animation for every guess row
    if (reduced) {
      rotate.value = 1
      shakeX.value = 0
      feedbackAnim.value = 0
      backgroundColor.value = colors.surface
      return
    }
    rotate.value = 0
    rotate.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })

    // Only run the success/failure animations for the most recent guess
    if (isLastGuess && lastGuessResult) {
      if (isCorrect) {
        // Success animation: Brief success color flash
        backgroundColor.value = withSequence(
          withDelay(600, withTiming(colors.success, { duration: 400 })),
          withDelay(1000, withTiming(colors.surface, { duration: 500 }))
        )
      } else {
        // Failure animation sequence:
        // 1. Show feedback overlay
        feedbackAnim.value = withSequence(
          withDelay(700, withTiming(1, { duration: 300 })),
          withDelay(1800, withTiming(0, { duration: 300, easing: Easing.ease }))
        )
        // 2. After feedback, shake the tile and flash error color
        shakeX.value = withSequence(
          withDelay(700, withTiming(-3, { duration: 60 })),
          withTiming(3, { duration: 120 }),
          withTiming(-2, { duration: 120 }),
          withTiming(0, { duration: 60 })
        )
        backgroundColor.value = colors.surface
      }
    }
    return () => {
      cancelAnimation(rotate)
      cancelAnimation(shakeX)
      cancelAnimation(backgroundColor)
      cancelAnimation(feedbackAnim)
    }
  }, [
    reduced,
    isLastGuess,
    lastGuessResult,
    isCorrect,
    colors,
    backgroundColor,
    rotate,
    shakeX,
    feedbackAnim,
  ])

  // --- Animated Style Definitions ---
  const animatedTileStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: backgroundColor.value,
      transform: [
        { translateY: interpolate(rotate.value, [0, 1], [28, 0]) },
        { rotateZ: `${interpolate(rotate.value, [0, 1], [-3, 0])}deg` },
        { translateX: shakeX.value },
      ],
    }
  })

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: rotate.value,
  }))

  const animatedFeedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackAnim.value,
    transform: [
      {
        scale: interpolate(feedbackAnim.value, [0, 1], [0.8, 1]),
      },
    ],
  }))

  return {
    animatedTileStyle,
    animatedContentStyle,
    animatedFeedbackStyle,
  }
}
