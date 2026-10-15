import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { LayoutAnimation } from "react-native"
import { useGameStore } from "../../state/gameStore"
import { hapticsService } from "../hapticsService"
import { analyticsService } from "../analyticsService"
import { useShallow } from "zustand/react/shallow"
import { DIFFICULTY_MODES } from "../../config/difficulty"
import { Hint } from "../../models/trivia"

type HintStatus = "available" | "used" | "disabled"
const emptyHints: Hint[] = []

export function useHintLogic() {
  const {
    playerGame,
    isInteractionsDisabled,
    playerStats,
    difficulty,
    useHint: requestHint,
    syncStatus,
  } = useGameStore(
    useShallow((state) => ({
      playerGame: state.playerGame,
      isInteractionsDisabled: state.isInteractionsDisabled,
      playerStats: state.playerStats,
      difficulty: state.difficulty,
      useHint: state.useHint,
      syncStatus: state.syncStatus,
    }))
  )

  const [showHintOptions, setShowHintOptions] = useState(false)
  const [selectedHint, setSelectedHint] = useState<{ gameKey: string; type: string } | null>(null)
  const gameKey = `${playerGame.playerID}:${playerGame.id}`
  const [highlightedHint, setHighlightedHint] = useState<string | null>(null)
  const prevHintsUsedRef = useRef<Partial<Record<string, boolean>>>(undefined)

  const hintsAvailable = playerStats?.hintsAvailable ?? 0
  const allHints: Hint[] = playerGame.triviaItem?.hints || emptyHints

  const currentHintStrategy = DIFFICULTY_MODES[difficulty].hintStrategy

  const hintStatuses = useMemo(() => {
    const statuses: Record<string, HintStatus> = {}
    const usedHints = playerGame.hintsUsed || {}

    for (const hint of allHints) {
      const type = hint.type
      if (isInteractionsDisabled || syncStatus !== "idle") {
        statuses[type] = "disabled"
      } else if (usedHints[type]) {
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
    syncStatus,
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
      if (currentHintStrategy !== "USER_SPEND" || isInteractionsDisabled || syncStatus !== "idle") return
      const status = hintStatuses[hintType]
      if (status !== "available" && status !== "used") return

      hapticsService.medium()

      setShowHintOptions(false)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setSelectedHint({ gameKey, type: hintType })

      if (status === "available") {
        void requestHint(hintType)
      }
    },
    [hintStatuses, currentHintStrategy, isInteractionsDisabled, syncStatus, gameKey, requestHint]
  )

  // Selecting is only intent. The server-confirmed state authorizes display,
  // including after a failed response is recovered by the durable retry path.
  const displayedHintText = currentHintStrategy === "USER_SPEND" &&
    selectedHint?.gameKey === gameKey && playerGame.hintsUsed?.[selectedHint.type]
      ? getHintText(selectedHint.type) : null

  useEffect(() => {
    if (currentHintStrategy !== "USER_SPEND") {
      setSelectedHint(null)
    }
  }, [playerGame.guesses.length, currentHintStrategy])

  const handleToggleHintOptions = useCallback(() => {
    if (currentHintStrategy !== "USER_SPEND" || isInteractionsDisabled || syncStatus !== "idle") return

    hapticsService.light()

    if (
      hintsAvailable <= 0 &&
      !Object.values(playerGame.hintsUsed || {}).some(Boolean)
    ) {
      return
    }

    if (!showHintOptions) {
      analyticsService.trackHintOptionsToggled()
      setSelectedHint(null)
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setShowHintOptions((prevShow) => !prevShow)
  }, [
    showHintOptions,
    hintsAvailable,
    playerGame.hintsUsed,
    currentHintStrategy,
    isInteractionsDisabled,
    syncStatus,
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
        return "Match an actor, director, genre or decade to reveal a hint."
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
    isInteractionsDisabled || syncStatus !== "idle" || currentHintStrategy !== "USER_SPEND"

  return {
    showHintOptions,
    displayedHintText,
    displayedHintType: displayedHintText ? selectedHint?.type : null,
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
