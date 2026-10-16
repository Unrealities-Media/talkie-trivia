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
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated"
import { hapticsService } from "../utils/hapticsService"
import Svg, { Circle, Path } from "react-native-svg"
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
  const { width, height } = useWindowDimensions()
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
  const [isAnimating, setIsAnimating] = useState(false)
  const revealedCount = useRef(0)
  const revealProgress = useSharedValue(1)
  const scrollViewRef = useRef<ScrollView>(null)
  const oldCluesText = revealedClues.slice(0, -1).join(" ")
  const shortClue = (itemDescription || "").split(/\s+/).length <= 12
  const projectionHeight = Math.max(48, Math.min(160, height - 620))
  const previousGuessCount = useRef(guesses.length)
  const scrollToNewText = useRef(false)
  const pulse = useSharedValue(1)
  const clueSize = PixelRatio.roundToNearestPixel(shortClue
    ? Math.max(24, Math.min(30, width * 0.07))
    : Math.max(22, Math.min(26, width * 0.06)))

  const handleSkipAnimation = useCallback(() => {
    cancelAnimation(revealProgress)
    revealProgress.value = 1
    setIsAnimating(false)
    hapticsService.light()
  }, [revealProgress])

  useEffect(() => {
    if (loading) return
    let animationFinished: ReturnType<typeof setTimeout> | undefined
    scrollToNewText.current = guesses.length > previousGuessCount.current
    previousGuessCount.current = guesses.length

    let numCluesToReveal
    const hintStrategy = DIFFICULTY_MODES[difficulty]?.hintStrategy
    const currentGuessCount = guesses.length

    if (correctAnswer || isInteractionsDisabled || hintStrategy === "EXTREME_CHALLENGE") {
      numCluesToReveal = clues.length
    } else if (
      hintStrategy === "ALL_REVEALED" ||
      hintStrategy === "HINTS_ONLY_REVEALED"
    ) {
      numCluesToReveal = Math.min(currentGuessCount + 1, clues.length)
    } else {
      numCluesToReveal = Math.min(currentGuessCount + 1, clues.length)
    }

    if (numCluesToReveal > revealedCount.current) {
      hapticsService.light()
      const newRevealedClues = clues.slice(0, numCluesToReveal)
      // Lay out the complete clue before the projector illuminates it.
      // Revealing characters individually made the paper jump between line breaks.
      revealProgress.value = reducedMotion ? 1 : 0
      setIsAnimating(!reducedMotion)
      if (!reducedMotion) {
        const delay = 120, duration = 850
        revealProgress.value = withDelay(delay,
          withTiming(1, { duration, easing: Easing.out(Easing.cubic) }))
        animationFinished = setTimeout(() => setIsAnimating(false), delay + duration)
      }
      setRevealedClues(newRevealedClues)
    } else {
      setRevealedClues(clues.slice(0, numCluesToReveal))
      revealProgress.value = 1
      setIsAnimating(false)
    }
    revealedCount.current = numCluesToReveal

    return () => {
      clearTimeout(animationFinished)
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
    reducedMotion,
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
  const canSkipAnimation = !isGameOver && !reducedMotion && isAnimating
  const moreClue = !isGameOver && difficulty !== "LEVEL_5" && revealedClues.length < clues.length
  useEffect(() => {
    pulse.value = 0
    if (moreClue && !reducedMotion) pulse.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(pulse)
  }, [moreClue, reducedMotion, pulse])
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${pulse.value * 360}deg` }] }))
  const clueTextStyle = [styles.text, { fontSize: clueSize, lineHeight: PixelRatio.roundToNearestPixel(clueSize * (Platform.OS === "android" ? 1.22 : 1.08)) }]

  return (
    <PremiereStage cue={guesses.length}>
    <View style={[styles.container, height < 650 && { minHeight: 40, marginVertical: 0 }]}>
      {loading ? (
        <CluesSkeleton />
      ) : (
        <>
          <ScrollView
            ref={scrollViewRef}
            testID="clue-viewport"
            style={[styles.scrollView, { maxHeight: projectionHeight }]}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <View style={{ minHeight: shortClue ? 48 : projectionHeight }}>
            <Pressable
              style={{ width: "100%" }}
              onPress={canSkipAnimation ? handleSkipAnimation : undefined}
              disabled={!canSkipAnimation}
              accessible={canSkipAnimation}
              accessibilityRole={canSkipAnimation ? "button" : undefined}
              accessibilityLabel={
                canSkipAnimation ? "Skip the current clue's text animation" : undefined
              }
            >
              <Animated.View onLayout={event => {
                if (!scrollToNewText.current) return
                scrollToNewText.current = false
                scrollViewRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.height - projectionHeight), animated: !reducedMotion })
              }} style={[styles.cluesBox, animatedHighlightStyle]}>
                <Text style={clueTextStyle}>
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
            </View>
          </ScrollView>
          <View style={{ height: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {moreClue && <View testID="next-clue-projector" accessible accessibilityRole="image" accessibilityLabel="More of the clue is available after an incorrect guess" style={{ flexDirection: "row", alignItems: "center", opacity: 0.55 }}>
              <Animated.View style={pulseStyle} accessible={false} importantForAccessibility="no-hide-descendants">
                <Svg width={16} height={16} viewBox="0 0 20 20" aria-hidden>
                  <Circle cx={10} cy={10} r={8} stroke="#675435" strokeWidth={1} fill="none" />
                  <Circle cx={10} cy={10} r={1.2} fill="#675435" />
                  {[ [10,5], [15,10], [10,15], [5,10] ].map(([cx,cy], i) => <Circle key={i} cx={cx} cy={cy} r={2} fill="#675435" />)}
                </Svg>
              </Animated.View>
              <Svg width={18} height={16} viewBox="0 0 22 20" aria-hidden>
                <Path d="M1 7H6V13H1M7 7L20 3V17L7 13Z" stroke="#675435" strokeWidth={1} fill="#B59B6825" />
              </Svg>
            </View>}
          </View>
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
    minHeight: 64,
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
    maxHeight: 120,
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
