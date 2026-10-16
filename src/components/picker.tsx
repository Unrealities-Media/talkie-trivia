import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Platform, View } from "react-native"
import { ListRenderItemInfo } from "@shopify/flash-list"
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated"
import { BasicTriviaItem, TriviaItem } from "../models/trivia"
import { PickerUI } from "./pickerUI"
import PickerSkeleton from "./pickerSkeleton"
import PickerItem from "./pickerItem"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useShallow } from "zustand/react/shallow"
import { createMovieSearch } from "../utils/movieSearch"
import { GAME_MODE_CONFIG } from "../config/difficulty"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

const PickerContainer: FC = memo(() => {
  const pickerRef = useRef<View>(null)
  const {
    isInteractionsDisabled,
    basicItems,
    fullItems,
    makeGuess,
    loading,
    gameMode,
    playerGame,
  } = useGameStore(
    useShallow((state) => ({
      isInteractionsDisabled: state.isInteractionsDisabled || state.syncStatus === "saving" || state.syncStatus === "pending",
      basicItems: state.basicItems,
      fullItems: state.fullItems,
      makeGuess: state.makeGuess,
      loading: state.loading,
      gameMode: state.gameMode,
      playerGame: state.playerGame,
    }))
  )

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<readonly BasicTriviaItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<number | string | null>(
    null
  )
  const [detailedItem, setDetailedItem] = useState<TriviaItem | null>(null)

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const guessedIds = useMemo(() => new Set(playerGame?.guesses.map(guess => String(guess.itemId)) || []), [playerGame?.guesses])
  const shakeAnimation = useSharedValue(0)
  const reduced = usePremiereMotion()
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  useEffect(() => {
    if (reduced) {
      cancelAnimation(shakeAnimation)
      shakeAnimation.value = 0
    }
    return () => cancelAnimation(shakeAnimation)
  }, [reduced, shakeAnimation])

  const triggerShake = useCallback(() => {
    if (reducedRef.current) return
    shakeAnimation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 100 }), 3, true),
      withTiming(0, { duration: 50 })
    )
  }, [shakeAnimation])

  const filterItems = useMemo(() => createMovieSearch(basicItems), [basicItems])

  const handleInputChange = useCallback(
    (text: string) => {
      if (isInteractionsDisabled) return

      setQuery(text)
      setExpandedItemId(null)
      setDetailedItem(null)
      setResults([])

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      const trimmedText = text.trim()
      if (!trimmedText) {
        setResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)

      searchTimeoutRef.current = setTimeout(() => {
        const filtered = filterItems(trimmedText)

        if (filtered.length > 0) {
          hapticsService.light()
        } else if (trimmedText.length > 2) {
          triggerShake()
        }

        setResults(filtered)
        setIsSearching(false)
      }, 300)
    },
    [isInteractionsDisabled, filterItems, triggerShake]
  )

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [filterItems, playerGame?.id, playerGame?.playerID])

  useEffect(() => {
    // Account/day/catalog changes must not retain another game's input or timer.
    setQuery("")
    setResults([])
    setIsSearching(false)
    setExpandedItemId(null)
    setDetailedItem(null)
  }, [filterItems, playerGame?.id, playerGame?.playerID])

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }))

  const handleLongPressItem = useCallback(
    (item: BasicTriviaItem) => {
      if (isInteractionsDisabled || guessedIds.has(String(item.id))) return
      hapticsService.medium()
      const newId = expandedItemId === item.id ? null : item.id
      setExpandedItemId(newId)

      if (newId) {
        const fullItem = fullItems.find((m) => m.id === newId)
        setDetailedItem(fullItem || null)
      } else {
        setDetailedItem(null)
      }
    },
    [expandedItemId, fullItems, isInteractionsDisabled, guessedIds]
  )

  const handleSelectItem = useCallback(
    (item: BasicTriviaItem) => {
      if (isInteractionsDisabled || guessedIds.has(String(item.id))) return
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const root = pickerRef.current as unknown as HTMLElement | null
        const active = document.activeElement
        // Hand off keyboard focus before clearing the selected result. Pointer
        // selection must not unexpectedly summon a phone's software keyboard.
        if (active?.getAttribute("role") === "button" && active.matches(":focus-visible") && root?.contains(active)) {
          root.querySelector<HTMLInputElement>('input[role="searchbox"]')?.focus()
        }
      }
      setExpandedItemId(null)
      setDetailedItem(null)
      makeGuess(item)
      handleInputChange("")
    },
    [makeGuess, handleInputChange, isInteractionsDisabled, guessedIds]
  )

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BasicTriviaItem>) => (
      <PickerItem
        item={item}
        detailedItem={detailedItem}
        isDisabled={isInteractionsDisabled}
        isGuessed={guessedIds.has(String(item.id))}
        isExpanded={expandedItemId === item.id}
        onSelect={handleSelectItem}
        onLongPress={handleLongPressItem}
      />
    ),
    [
      isInteractionsDisabled,
      guessedIds,
      expandedItemId,
      detailedItem,
      handleSelectItem,
      handleLongPressItem,
    ]
  )

  const showResults = query.trim().length > 0 || isSearching

  if (loading) {
    return <PickerSkeleton />
  }

  return (
    <View ref={pickerRef} style={{ width: "100%" }}>
      <PickerUI
        query={query}
        isSearching={isSearching}
        results={results}
        showResults={showResults}
        animatedInputStyle={animatedInputStyle}
        isInteractionsDisabled={isInteractionsDisabled}
        handleInputChange={handleInputChange}
        renderItem={renderItem}
        placeholder={GAME_MODE_CONFIG[gameMode].searchPlaceholder}
      />
    </View>
  )
})

export default PickerContainer
