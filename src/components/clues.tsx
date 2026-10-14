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
  useWindowDimensions,
  PixelRatio,
  Platform,
} from "react-native"
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withDelay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useShallow } from "zustand/react/shallow"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { useSkeletonAnimation } from "../utils/hooks/useSkeletonAnimation"
import PremiereStage, { premiere } from "./premiereStage"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

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
  const { width } = useWindowDimensions()
  const reducedMotion = usePremiereMotion()

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
  const revealProgress = useSharedValue(1)
  const scrollViewRef = useRef<ScrollView>(null)
  const oldCluesText = revealedClues.slice(0, -1).join(" ")
  const visibleWordCount = revealedClues.join(" ").split(/\s+/).filter(Boolean).length
  const shortClue = visibleWordCount <= 12
  const clueSize = PixelRatio.roundToNearestPixel(shortClue
    ? Math.max(28, Math.min(42, width * (width < 360 ? 0.088 : 0.091)))
    : Math.max(30, Math.min(34, width * 0.082)))

  const handleSkipAnimation = useCallback(() => {
    cancelAnimation(revealProgress)
    revealProgress.value = 1
    hapticsService.light()
  }, [revealProgress])

  useEffect(() => {
    if (loading) return
    let scrollTimer: ReturnType<typeof setTimeout> | undefined

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
      // Lay out the complete clue before the projector illuminates it.
      // Revealing characters individually made the paper jump between line breaks.
      revealProgress.value = reducedMotion ? 1 : 0
      if (!reducedMotion) revealProgress.value = withDelay(120,
        withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }))
      setRevealedClues(newRevealedClues)
      scrollTimer = setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: !reducedMotion }),
        100
      )
    } else if (numCluesToReveal < revealedClues.length) {
      setRevealedClues(clues.slice(0, numCluesToReveal))
      revealProgress.value = 1
    }

    return () => {
      clearTimeout(scrollTimer)
      cancelAnimation(revealProgress)
    }
  }, [
    loading,
    correctAnswer,
    isInteractionsDisabled,
    guesses.length,
    clues,
    difficulty,
    revealProgress,
  ])

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(revealProgress)
      revealProgress.value = 1
    }
  }, [reducedMotion, revealProgress])

  const animatedHighlightStyle = useAnimatedStyle(() => {
    return { opacity: 0.2 + revealProgress.value * 0.8 }
  })

  const isGameOver = correctAnswer || isInteractionsDisabled

  return (
    <PremiereStage cue={guesses.length}>
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
              <Animated.View style={[styles.cluesBox, animatedHighlightStyle]}>
                <Text style={[styles.text, { fontSize: clueSize, lineHeight: PixelRatio.roundToNearestPixel(clueSize * (Platform.OS === "android" ? 1.22 : 1.08)) }, shortClue && { width: "100%", maxWidth: 320, alignSelf: "center" }]}>
                  {oldCluesText}
                  {oldCluesText ? " " : ""}
                  {isGameOver ? (
                    <Text>
                      {clues.slice(revealedClues.length - 1).join(" ")}
                    </Text>
                  ) : (
                    <Text>
                      {revealedClues[revealedClues.length - 1] || ""}
                    </Text>
                  )}
                </Text>
              </Animated.View>
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
    </PremiereStage>
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
    justifyContent: "flex-start",
    marginVertical: theme.spacing.extraSmall,
    minHeight: 100,
    paddingHorizontal: theme.spacing.small,
    width: "100%",
    alignSelf: "stretch",
  },
  countContainer: {
    height: 0,
    overflow: "hidden",
    alignSelf: "flex-end",
    marginBottom: theme.responsive.scale(4),
    marginRight: theme.spacing.large,
    marginTop: 0,
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: "100%",
  },
  text: {
    ...theme.typography.bodyText,
    fontFamily: "PremiereClue",
    fontSize: 34,
    lineHeight: 35,
    color: premiere.ink,
    textAlign: "center",
  },
  wordCountText: {
    ...theme.typography.caption,
    fontSize: theme.responsive.responsiveFontSize(11),
    color: "#534A3C",
    textAlign: "right",
  },
})

export default CluesContainer
