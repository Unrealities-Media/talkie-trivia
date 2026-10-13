import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { LayoutAnimation, Platform, UIManager } from "react-native"
import { useGameStore } from "../../state/gameStore"
import { hapticsService } from "../hapticsService"
import { analyticsService } from "../analyticsService"
import { useShallow } from "zustand/react/shallow"
import { DIFFICULTY_MODES } from "../../config/difficulty"
import { Hint } from "../../models/trivia"

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type HintStatus = "available" | "used" | "disabled"

export function useHintLogic() {
  const {
    playerGame,
    isInteractionsDisabled,
    playerStats,
    difficulty,
    useHint,
  } = useGameStore(
    useShallow((state) => ({
      playerGame: state.playerGame,
      isInteractionsDisabled: state.isInteractionsDisabled,
      playerStats: state.playerStats,
      difficulty: state.difficulty,
      useHint: state.useHint,
    }))
  )

  const [showHintOptions, setShowHintOptions] = useState(false)
  const [displayedHintText, setDisplayedHintText] = useState<string | null>(
    null
  )
  const [highlightedHint, setHighlightedHint] = useState<string | null>(null)
  const prevHintsUsedRef = useRef<Partial<Record<string, boolean>>>(undefined)

  const hintsAvailable = playerStats?.hintsAvailable ?? 0
  const allHints: Hint[] = playerGame.triviaItem?.hints || []

  const currentHintStrategy = DIFFICULTY_MODES[difficulty].hintStrategy

  const hintStatuses = useMemo(() => {
    const statuses: Record<string, HintStatus> = {}
    const usedHints = playerGame.hintsUsed || {}

    for (const hint of allHints) {
      const type = hint.type
      if (usedHints[type]) {
        statuses[type] = "used"
      } else if (
        currentHintStrategy === "NONE_DISABLED" ||
        currentHintStrategy === "EXTREME_CHALLENGE" ||
        currentHintStrategy === "ALL_REVEALED" ||
        isInteractionsDisabled ||
        (currentHintStrategy === "USER_SPEND" && hintsAvailable <= 0)
      ) {
        statuses[type] = "disabled"
      } else {
        statuses[type] = "available"
      }
    }
    return statuses
  }, [
    playerGame.hintsUsed,
    isInteractionsDisabled,
    hintsAvailable,
    currentHintStrategy,
    allHints,
  ])

  useEffect(() => {
    const currentHints = playerGame.hintsUsed || {}
    const previousHints = prevHintsUsedRef.current || {}

    if (currentHintStrategy !== "IMPLICIT_FEEDBACK") {
      prevHintsUsedRef.current = currentHints
      return
    }

    const newHint = (Object.keys(currentHints) as string[]).find(
      (key) => currentHints[key] && !previousHints[key]
    )

    if (newHint) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setShowHintOptions(true)
      setHighlightedHint(newHint)

      const timer = setTimeout(() => setHighlightedHint(null), 2500)
      return () => clearTimeout(timer)
    }

    prevHintsUsedRef.current = currentHints
  }, [playerGame.hintsUsed, currentHintStrategy])

  const getHintText = useCallback(
    (hintType: string): string => {
      if (!playerGame?.triviaItem) return "Hint unavailable"

      const hint = playerGame.triviaItem.hints.find((h) => h.type === hintType)
      if (!hint) return "Hint unavailable"

      // Handle special formatting for different hint types
      if (
        hint.type === "actors" &&
        Array.isArray(hint.value) &&
        hint.value.length > 0
      ) {
        return hint.value[0]?.name || "Actor unavailable"
      }

      return hint.value?.toString() || `${hint.label} unavailable`
    },
    [playerGame.triviaItem]
  )

  const handleHintSelection = useCallback(
    (hintType: string) => {
      if (currentHintStrategy !== "USER_SPEND") return

      hapticsService.medium()

      const status = hintStatuses[hintType]
      setShowHintOptions(false)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setDisplayedHintText(getHintText(hintType))

      if (status === "available") {
        useHint(hintType)
      }
    },
    [hintStatuses, currentHintStrategy, getHintText, useHint]
  )

  useEffect(() => {
    if (currentHintStrategy !== "USER_SPEND") {
      setDisplayedHintText(null)
    }
  }, [playerGame.guesses.length, currentHintStrategy])

  const handleToggleHintOptions = useCallback(() => {
    if (currentHintStrategy !== "USER_SPEND") return

    hapticsService.light()

    if (
      hintsAvailable <= 0 &&
      !Object.values(playerGame.hintsUsed || {}).some(Boolean)
    ) {
      return
    }

    if (!showHintOptions) {
      analyticsService.trackHintOptionsToggled()
      setDisplayedHintText(null)
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setShowHintOptions((prevShow) => !prevShow)
  }, [
    showHintOptions,
    hintsAvailable,
    playerGame.hintsUsed,
    currentHintStrategy,
  ])

  const hintLabelText = useMemo(() => {
    if (isInteractionsDisabled) return "Game Over"

    switch (currentHintStrategy) {
      case "ALL_REVEALED":
        return "All Clues Revealed"
      case "USER_SPEND": {
        const usedHintsCount = Object.values(playerGame.hintsUsed || {}).filter(
          (v) => v
        ).length
        const effectiveHints = Math.max(0, hintsAvailable)

        if (effectiveHints <= 0 && usedHintsCount === 0) {
          return ""
        }
        return `Need a Hint? (${effectiveHints} available)`
      }
      case "IMPLICIT_FEEDBACK":
        return "Hints are revealed by successful guesses!"
      case "NONE_DISABLED":
      case "EXTREME_CHALLENGE":
        return ""
      default:
        return ""
    }
  }, [
    hintsAvailable,
    isInteractionsDisabled,
    playerGame.hintsUsed,
    currentHintStrategy,
  ])

  const isToggleDisabled =
    isInteractionsDisabled || currentHintStrategy !== "USER_SPEND"

  return {
    showHintOptions,
    displayedHintText,
    hintLabelText,
    isToggleDisabled,
    hintStatuses,
    highlightedHint,
    allHints: allHints,
    getHintText,
    handleToggleHintOptions,
    handleHintSelection,
  }
}
