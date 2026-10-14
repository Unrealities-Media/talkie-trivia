import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  memo,
  useCallback,
} from "react"
import {
  Text,
  View,
  ScrollView,
  Pressable,
  ViewStyle,
  TextStyle,
} from "react-native"
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  runOnJS,
  withSequence,
  withDelay,
  interpolateColor,
  useAnimatedReaction,
  cancelAnimation,
  Easing,
} from "react-native-reanimated"
import { hapticsService } from "../utils/hapticsService"
import { ANIMATION_CONSTANTS } from "../config/constants"
import { useGameStore } from "../state/gameStore"
import { useShallow } from "zustand/react/shallow"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { useStyles, useThemeTokens, Theme } from "../utils/hooks/useStyles"
import { useSkeletonAnimation } from "../utils/hooks/useSkeletonAnimation"

const CluesSkeleton = memo(() => {
  const styles = useStyles(themedStyles)
  const animatedStyle = useSkeletonAnimation()
  return (
    <Animated.View
      style={[styles.skeletonContainer, animatedStyle]}
      testID="clues-skeleton"
    >
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
    </Animated.View>
  )
})

const splitSummary = (summary: string, splits: number = 5): string[] => {
  if (!summary) return Array(splits).fill("")
  const words = summary.trim().split(/\s+/)
  if (words.length === 0) return Array(splits).fill("")
  const avgLength = Math.max(1, Math.ceil(words.length / splits))
  return Array.from({ length: splits }, (_, i) =>
    words.slice(i * avgLength, (i + 1) * avgLength).join(" ")
  ).filter((chunk) => chunk.length > 0)
}

const CountContainer = memo(
  ({
    currentWordLength,
    totalWordLength,
  }: {
    currentWordLength: number
    totalWordLength: number
  }) => {
    const styles = useStyles(themedStyles)
    return (
      <View style={styles.countContainer}>
        <Text style={styles.wordCountText}>
          {currentWordLength}/{totalWordLength} words revealed
        </Text>
      </View>
    )
  }
)

const CluesContainer = memo(() => {
  const styles = useStyles(themedStyles)
  const theme = useThemeTokens()

  const {
    correctAnswer,
    guesses,
    itemDescription,
    isInteractionsDisabled,
    difficulty,
    loading,
  } = useGameStore(
    useShallow((state) => ({
      correctAnswer: state.playerGame.correctAnswer,
      guesses: state.playerGame.guesses,
      itemDescription: state.playerGame.triviaItem?.description,
      isInteractionsDisabled: state.isInteractionsDisabled,
      difficulty: state.difficulty,
      loading: state.loading,
    }))
  )

  const clues = useMemo(
    () => splitSummary(itemDescription || ""),
    [itemDescription]
  )
  const [revealedClues, setRevealedClues] = useState<string[]>([])
  const [typewriterText, setTypewriterText] = useState("")
  const fullClueShared = useSharedValue("")

  const highlightProgress = useSharedValue(0)
  const typewriterProgress = useSharedValue(0)
  const scrollViewRef = useRef<ScrollView>(null)
  const oldCluesText = revealedClues.slice(0, -1).join(" ")

  const handleSkipAnimation = useCallback(() => {
    cancelAnimation(typewriterProgress)
    setTypewriterText(fullClueShared.value)
    hapticsService.light()
  }, [typewriterProgress, fullClueShared])

  useAnimatedReaction(
    () => Math.floor(typewriterProgress.value),
    (currentValue, previousValue) => {
      if (currentValue !== previousValue) {
        const text = fullClueShared.value.substring(0, currentValue)
        runOnJS(setTypewriterText)(text)
      }
    },
    [typewriterProgress, fullClueShared]
  )

  useEffect(() => {
    if (loading) return

    let numCluesToReveal
    const hintStrategy = DIFFICULTY_MODES[difficulty]?.hintStrategy
    const currentGuessCount = guesses.length

    if (correctAnswer || isInteractionsDisabled) {
      numCluesToReveal = clues.length
    } else if (
      hintStrategy === "ALL_REVEALED" ||
      hintStrategy === "HINTS_ONLY_REVEALED"
    ) {
      numCluesToReveal = Math.min(currentGuessCount + 1, clues.length)
    } else {
      numCluesToReveal = Math.min(currentGuessCount + 1, clues.length)
    }

    if (numCluesToReveal > revealedClues.length) {
      hapticsService.light()
      const newRevealedClues = clues.slice(0, numCluesToReveal)
      const lastClue = newRevealedClues[newRevealedClues.length - 1] || ""

      fullClueShared.value = lastClue

      highlightProgress.value = 0
      typewriterProgress.value = 0
      setTypewriterText(process.env.NODE_ENV === "test" ? lastClue : "")

      const typewriterDuration =
        lastClue.length * ANIMATION_CONSTANTS.TYPEWRITER_CHAR_DURATION
      highlightProgress.value = withSequence(
        withTiming(1, { duration: 400 }),
        withDelay(typewriterDuration + 200, withTiming(0, { duration: 500 }))
      )
      typewriterProgress.value = withDelay(
        200,
        withTiming(lastClue.length, {
          duration: typewriterDuration,
          easing: Easing.linear,
        })
      )
      setRevealedClues(newRevealedClues)
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100
      )
    } else if (numCluesToReveal < revealedClues.length) {
      setRevealedClues(clues.slice(0, numCluesToReveal))
      const lastClue = clues[numCluesToReveal - 1] || ""
      setTypewriterText(lastClue)
      fullClueShared.value = lastClue
    }

    return () => {
      cancelAnimation(typewriterProgress)
      cancelAnimation(highlightProgress)
    }
  }, [
    loading,
    correctAnswer,
    isInteractionsDisabled,
    guesses.length,
    clues,
    difficulty,
    fullClueShared,
  ])

  const animatedHighlightStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      highlightProgress.value,
      [0, 1],
      ["transparent", theme.colors.primary]
    )
    const color = interpolateColor(
      highlightProgress.value,
      [0, 1],
      [theme.colors.textPrimary, theme.colors.background]
    )
    return { backgroundColor, color }
  })

  const isGameOver = correctAnswer || isInteractionsDisabled

  return (
    <View style={styles.container}>
      {loading ? (
        <CluesSkeleton />
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={isGameOver ? undefined : handleSkipAnimation}
              accessible={!isGameOver}
              accessibilityRole="button"
              accessibilityLabel={
                !isGameOver ? "Tap to reveal the full clue immediately" : ""
              }
            >
              <View style={styles.cluesBox}>
                <Text style={styles.text}>
                  {oldCluesText}
                  {oldCluesText ? " " : ""}
                  {isGameOver ? (
                    <Text>
                      {clues.slice(revealedClues.length - 1).join(" ")}
                    </Text>
                  ) : (
                    <Animated.Text style={animatedHighlightStyle}>
                      {typewriterText}
                    </Animated.Text>
                  )}
                </Text>
              </View>
            </Pressable>
          </ScrollView>
          <CountContainer
            currentWordLength={
              revealedClues.join(" ").split(" ").filter(Boolean).length
            }
            totalWordLength={clues.join(" ").split(" ").filter(Boolean).length}
          />
        </>
      )}
    </View>
  )
})

interface CluesStyles {
  container: ViewStyle
  countContainer: ViewStyle
  scrollView: ViewStyle
  scrollViewContent: ViewStyle
  skeletonContainer: ViewStyle
  skeletonLine: ViewStyle
  skeletonLineShort: ViewStyle
  cluesBox: ViewStyle
  text: TextStyle
  wordCountText: TextStyle
}

const themedStyles = (theme: Theme): CluesStyles => ({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    marginVertical: theme.spacing.extraSmall,
    minHeight: theme.responsive.scale(160),
    paddingHorizontal: theme.spacing.small,
    width: "100%",
    alignSelf: "stretch",
  },
  countContainer: {
    alignSelf: "flex-end",
    marginBottom: theme.responsive.scale(4),
    marginRight: theme.spacing.large,
    marginTop: theme.spacing.small,
  },
  scrollView: {
    flexGrow: 1,
    width: "100%",
    alignSelf: "stretch",
  },
  scrollViewContent: {
    paddingBottom: theme.spacing.extraSmall,
  },
  skeletonContainer: {
    paddingHorizontal: theme.spacing.small,
    paddingVertical: theme.spacing.small,
    width: "100%",
    height: "100%",
    justifyContent: "center",
  },
  skeletonLine: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(4),
    height: theme.responsive.responsiveFontSize(16),
    marginBottom: theme.spacing.medium,
    width: "100%",
  },
  skeletonLineShort: {
    width: "70%",
  },
  cluesBox: {
    paddingHorizontal: theme.spacing.medium,
    paddingVertical: theme.spacing.medium,
    width: "100%",
  },
  text: {
    ...theme.typography.bodyText,
    fontSize: theme.responsive.responsiveFontSize(14),
    lineHeight: theme.responsive.responsiveFontSize(20),
    color: theme.colors.textPrimary,
  },
  wordCountText: {
    ...theme.typography.caption,
    fontSize: theme.responsive.responsiveFontSize(11),
    color: theme.colors.accentText,
    textAlign: "right",
  },
})

export default CluesContainer
