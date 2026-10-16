import React, { useState, useEffect, useRef, memo, useCallback } from "react"
import { View, Pressable, Platform, GestureResponderEvent } from "react-native"
import { Image } from "expo-image"
import { FlashList } from "@shopify/flash-list"
import Animated from "react-native-reanimated"
import { useAuth } from "../contexts/authContext"
import { GameHistoryEntry } from "../models/gameHistory"
import { hapticsService } from "../utils/hapticsService"
import { API_CONFIG } from "../config/constants"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { gameService, HistoryCursor } from "../services/gameService"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { useSkeletonAnimation } from "../utils/hooks/useSkeletonAnimation"
import { useGameStore } from "../state/gameStore"
import ErrorMessage from "./errorMessage"
import { Button } from "./ui/button"

const GameHistorySkeletonItem = memo(() => {
  const styles = useStyles(themedStyles)
  const animatedStyle = useSkeletonAnimation()

  return (
    <Animated.View
      style={[styles.itemContainer, animatedStyle]}
      testID="skeleton-item"
    >
      <View style={styles.skeletonPoster} />
      <View style={styles.infoContainer}>
        <View style={[styles.skeletonText, { width: "80%", height: 20 }]} />
        <View style={[styles.skeletonText, { width: "60%", marginTop: 8 }]} />
        <View style={[styles.skeletonText, { width: "40%", marginTop: 4 }]} />
      </View>
    </Animated.View>
  )
})

interface GameHistoryItemProps {
  item: GameHistoryEntry
  onPress: (item: GameHistoryEntry) => void
  compact?: boolean
}

const GameHistoryItem = memo(({ item, onPress, compact }: GameHistoryItemProps) => {
  const styles = useStyles(themedStyles)
  const posterUri = `${API_CONFIG.TMDB_IMAGE_BASE_URL_W185}${item.posterPath}`
  const difficultyLabel = DIFFICULTY_MODES[item.difficulty]?.label || "Unknown"
  const date = new Date(item.dateId)
  const formattedDate = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const outcome = item.wasCorrect
    ? `Solved in ${item.guessCount} ${item.guessCount === 1 ? "guess" : "guesses"}`
    : item.gaveUp ? "Gave up" : "Not solved"

  const handlePress = () => {
    hapticsService.light()
    onPress(item)
  }

  const getResultText = () => {
    if (item.wasCorrect) {
      return (
        <Typography style={[styles.resultText, styles.winText]}>
          Correct in {item.guessCount}/{item.guessesMax} guesses!
        </Typography>
      )
    }
    return (
      <Typography style={[styles.resultText, styles.lossText]}>
        {item.gaveUp ? "Gave up" : "Incorrect"}
      </Typography>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${item.itemTitle} result. ${formattedDate}. ${difficultyLabel}. ${outcome}. ${item.score} ${item.score === 1 ? "point" : "points"}.`}
      testID={`history-item-${item.itemTitle}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.itemContainer,
        compact && styles.compactItem,
        pressed && styles.itemPressed,
      ]}
    >
      <Image source={item.posterPath ? { uri: posterUri } : require("../../assets/movie_default.png")} style={[styles.posterImage, compact && { width: 44, height: 65 }]} />
      <View style={styles.infoContainer}>
        <Typography style={[styles.itemTitle, compact && { fontSize: 14 }]} numberOfLines={2}>
          {item.itemTitle}
        </Typography>
        {!compact && <Typography style={styles.dateText}>{formattedDate}</Typography>}
        {compact ? <Typography style={styles.compactResult}>
          {difficultyLabel} · {outcome}
        </Typography> : <>
          <Typography style={styles.difficultyText}>Difficulty: {difficultyLabel}</Typography>
          {getResultText()}
        </>}
      </View>
      <View style={styles.scoreContainer}>
        <Typography style={[styles.scoreText, compact && { fontSize: 15 }]}>{item.score}</Typography>
        <Typography style={styles.scoreLabel}>PTS</Typography>
      </View>
    </Pressable>
  )
})

interface GameHistoryProps {
  onHistoryItemPress: (item: GameHistoryEntry) => void
  compact?: boolean
}

const HistoryForAccount = ({ uid, onHistoryItemPress, compact = false }: GameHistoryProps & { uid: string | null }) => {
  const styles = useStyles(themedStyles)
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [cursors, setCursors] = useState<(HistoryCursor | null)[]>([null])
  const [next, setNext] = useState<HistoryCursor | null>(null)
  const historyRef = useRef<View>(null)
  const pageStatusRef = useRef<HTMLDivElement>(null)
  const navigate = (action: () => void, event?: GestureResponderEvent) => {
    if (loading) return
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const active = document.activeElement
      const root = historyRef.current as unknown as HTMLElement | null
      // Keyboard and assistive activation dispatch clicks with detail 0.
      // Firefox can keep :focus-visible false after Enter, so CSS focus styling
      // alone cannot identify the activation method.
      const keyboardActivation = (event?.nativeEvent as unknown as MouseEvent | undefined)?.detail === 0
      // Move before the focused control is disabled or removed. Never reclaim
      // focus when the request finishes: the player may have moved elsewhere.
      if (active?.getAttribute("role") === "button" && keyboardActivation
        && root?.contains(active)) {
        pageStatusRef.current?.focus()
      }
    }
    action()
  }
  const pageStatus = loading ? `Loading history page ${page + 1}…`
    : error ? `History page ${page + 1} could not be loaded.`
    : `History page ${page + 1} · Newest games first`

  useEffect(() => {
    let active = true
    setHistory([])
    setError(null)
    setLoading(true)
    setNext(null)
    const fetchHistory = async () => {
      if (!uid) {
        setLoading(false)
        return
      }

      try {
        const result = await gameService.fetchGameHistory(uid, cursors[page])
        if (active) { setHistory(result.entries); setNext(result.next) }
      } catch {
        if (active) setError("Could not load game history.")
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchHistory()
    return () => { active = false }
  }, [uid, page, cursors, attempt])

  const renderItem = useCallback(
    ({ item }: { item: GameHistoryEntry }) => (
      <GameHistoryItem item={item} onPress={onHistoryItemPress} />
    ),
    [onHistoryItemPress]
  )

  return (
    <View ref={historyRef} style={styles.container}>
      {uid && !compact && <View style={styles.pageControls}>
        {Platform.OS === "web" ? <div ref={pageStatusRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true">
          <Typography>{pageStatus}</Typography>
        </div> : <Typography accessibilityLiveRegion="polite">{pageStatus}</Typography>}
        <Button title="Refresh history" variant="secondary" disabled={loading} onPress={event => navigate(() => {
          setPage(0); setCursors([null]); setAttempt(value => value + 1)
        }, event)} />
        {page > 0 && <Button title="Newer games" variant="secondary" disabled={loading} onPress={event => navigate(() => setPage(page - 1), event)} />}
        {next && <Button title="Older games" variant="secondary" disabled={loading} onPress={event => navigate(() => {
          setCursors(previous => [...previous.slice(0, page + 1), next]); setPage(page + 1)
        }, event)} />}
      </View>}
      {loading ? <View>
        {Array(compact ? 3 : 5)
          .fill(0)
          .map((_, index) => (
            <GameHistorySkeletonItem key={`skeleton-${index}`} />
          ))}
      </View> : error ? <View style={styles.emptyContainer}>
        <ErrorMessage message={error} onRetry={event => navigate(() => setAttempt(value => value + 1), event)} />
      </View> : compact ? <View>
        {history.slice(0, 3).map(item => <GameHistoryItem key={item.challengeId ?? `${item.dateId}-${item.difficulty}-${item.itemId}`} item={item} onPress={onHistoryItemPress} compact />)}
        {history.length === 0 && <Typography style={styles.emptyText}>Your collection starts with your first completed challenge.</Typography>}
      </View> :
      <FlashList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.challengeId ?? `${item.dateId}-${item.difficulty}-${item.itemId}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Typography style={styles.emptyText}>
              {page === 0 ? "Play a game to see your history here!" : "No older games on this page. Refresh history to see your latest results."}
            </Typography>
          </View>
        )}
      />}
    </View>
  )
}

const GameHistory = (props: GameHistoryProps) => {
  const { player } = useAuth()
  const completedGames = useGameStore(state => state.playerStats.games)
  // Immediately discard rows/cursors and cancel late responses on account
  // changes or a confirmed completion, even when Profile stays mounted.
  return <HistoryForAccount key={`${player?.id ?? "signed-out"}:${completedGames}`} uid={player?.id ?? null} {...props} />
}

const themedStyles = (theme: Theme): any => ({
  compactItem: {
    backgroundColor: "transparent", borderWidth: 0, borderBottomWidth: 1,
    borderRadius: 0, paddingHorizontal: 0, paddingVertical: 8, marginBottom: 0,
  },
  compactResult: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  container: {
    flex: 1,
    width: "100%",
    minHeight: 200,
  },
  listContainer: {
    paddingBottom: theme.spacing.large,
  },
  pageControls: {
    gap: theme.spacing.small,
    marginBottom: theme.spacing.medium,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.responsive.scale(8),
    marginBottom: theme.spacing.small,
    padding: theme.spacing.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemPressed: {
    backgroundColor: theme.colors.surface,
  },
  posterImage: {
    width: theme.responsive.scale(60),
    height: theme.responsive.scale(90),
    borderRadius: theme.responsive.scale(4),
  },
  infoContainer: {
    flex: 1,
    marginLeft: theme.spacing.medium,
  },
  itemTitle: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.extraSmall,
  },
  dateText: {
    ...theme.typography.caption,
    marginBottom: theme.spacing.extraSmall,
  },
  difficultyText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(12),
    color: theme.colors.accentText,
    marginBottom: theme.spacing.extraSmall,
  },
  resultText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
  },
  winText: {
    color: theme.colors.success,
  },
  lossText: {
    color: theme.colors.error,
  },
  scoreContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: theme.spacing.small,
  },
  scoreText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(20),
    color: theme.colors.accentText,
  },
  scoreLabel: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(10),
    color: theme.colors.textSecondary,
    marginTop: -theme.spacing.extraSmall,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.large,
  },
  emptyText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  skeletonPoster: {
    width: theme.responsive.scale(60),
    height: theme.responsive.scale(90),
    borderRadius: theme.responsive.scale(4),
    backgroundColor: theme.colors.surface,
  },
  skeletonText: {
    backgroundColor: theme.colors.surface,
    height: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
})

export default GameHistory
