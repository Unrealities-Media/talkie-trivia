import React, { useState, useEffect, Suspense, lazy } from "react"
import {
  View,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
  TextStyle,
} from "react-native"
import { GameHistoryEntry } from "../models/gameHistory"
import { TriviaItem, BasicTriviaItem } from "../models/trivia"
import { PlayerGame } from "../models/game"
import { useAuth } from "../contexts/authContext"
import { gameService } from "../services/gameService"
import { MovieDataService } from "../services/movieDataService"
import { useStyles, Theme, useThemeTokens } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import DetailModal from "./detailModal"
import Facts from "./facts"
import ResultSummary from "./gameOver/resultSummary"
import FullPlotSection from "./gameOver/fullPlotSection"

const GuessesContainer = lazy(() => import("./guesses"))

interface HistoryDetailModalProps {
  historyItem: GameHistoryEntry | null
  onClose: () => void
}

const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({
  historyItem,
  onClose,
}) => {
  const { player } = useAuth()
  const styles = useStyles(themedStyles)
  const theme = useThemeTokens()

  const [item, setItem] = useState<TriviaItem | null>(null)
  const [playerGame, setPlayerGame] = useState<PlayerGame | null>(null)
  const [allBasicItems, setAllBasicItems] = useState<
    readonly BasicTriviaItem[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!historyItem || !player) {
      setItem(null)
      setPlayerGame(null)
      return
    }

    let active = true
    setItem(null)
    setPlayerGame(null)
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const playerGameId = `movies_${historyItem.dateId}`
        const fetchedPlayerGame = await gameService.fetchPlayerGameById(playerGameId)
        const fetchedItem = fetchedPlayerGame?.triviaItem
        const { basicItems } = new MovieDataService().getCatalogLists()
        if (!active) return

        if (fetchedItem && fetchedPlayerGame) {
          setItem(fetchedItem)
          setPlayerGame(fetchedPlayerGame)
          setAllBasicItems(basicItems)
        } else {
          throw new Error("Could not find item or game history details.")
        }
      } catch (e: any) {
        if (!active) return
        console.error("Failed to fetch history details:", e)
        setError(e.message || "Failed to load history.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    fetchData()
    return () => { active = false }
  }, [historyItem, player])

  const renderModalContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )
    }
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Typography variant="error">{error}</Typography>
        </View>
      )
    }
    if (item) {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {playerGame && <ResultSummary game={playerGame} />}
          <Facts item={item} isScrollEnabled={false} compact={true} />
          <FullPlotSection overview={item.description} />
          {playerGame && (
            <View style={styles.guessesSection}>
              <View style={styles.divider} />
              <Typography variant="h2" style={styles.guessesTitle}>
                Your Guesses
              </Typography>
              <Suspense
                fallback={
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                }
              >
                <GuessesContainer
                  gameForDisplay={playerGame}
                  allItemsForDisplay={allBasicItems}
                  lastGuessResult={null}
                />
              </Suspense>
            </View>
          )}
        </ScrollView>
      )
    }
    return null
  }

  return (
    <Suspense fallback={null}>
      <DetailModal show={!!historyItem} toggleModal={onClose} playerGame={playerGame}>
        {renderModalContent()}
      </DetailModal>
    </Suspense>
  )
}

interface HistoryDetailModalStyles {
  loadingContainer: ViewStyle
  errorContainer: ViewStyle
  scrollView: ViewStyle
  scrollContent: ViewStyle
  guessesSection: ViewStyle
  divider: ViewStyle
  guessesTitle: TextStyle
}

const themedStyles = (theme: Theme): HistoryDetailModalStyles => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: theme.responsive.scale(300),
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.large,
    minHeight: theme.responsive.scale(300),
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.medium,
  },
  guessesSection: {
    marginTop: theme.spacing.small,
    width: "100%",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.small,
    width: "80%",
    alignSelf: "center",
  },
  guessesTitle: {
    fontSize: theme.responsive.responsiveFontSize(18),
    textAlign: "center",
    marginBottom: theme.spacing.small,
    color: theme.colors.textPrimary,
    fontFamily: "PremiereSans",
  },
})

export default HistoryDetailModal
