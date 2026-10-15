import { useTheme } from "../contexts/themeContext"
import React, { memo, useMemo, useCallback } from "react"
import { Text, View, ViewStyle } from "react-native"
import { BasicTriviaItem } from "../models/trivia"
import { useGameStore } from "../state/gameStore"
import { HintInfo, PlayerGame, Guess } from "../models/game"
import { useShallow } from "zustand/react/shallow"
import { GuessRow } from "./guess/guessRow"
import { SkeletonRow } from "./guess/skeletonRow"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { isCompletedGame } from "../utils/resultSummary"

type GuessResult = {
  itemId: number | string
  correct: boolean
  feedback?: string | null
  hintInfo?: HintInfo[] | null
} | null

interface GuessesContainerProps {
  lastGuessResult: GuessResult
  gameForDisplay?: PlayerGame
  allItemsForDisplay?: readonly BasicTriviaItem[]
}

type ListItem =
  | { type: "guess"; guess: Guess; index: number }
  | { type: "skeleton"; index: number }

const GuessesContainer = memo(
  ({
    lastGuessResult,
    gameForDisplay,
    allItemsForDisplay,
  }: GuessesContainerProps) => {
    const { loading, playerGame, basicItems } = useGameStore(
      useShallow((state) => ({
        loading: state.loading,
        playerGame: state.playerGame,
        basicItems: state.basicItems,
      }))
    )
    const styles = useStyles(themedStyles)
    const { colors } = useTheme()

    const isDataLoading = gameForDisplay ? false : loading
    const currentGame = gameForDisplay || playerGame
    const items = allItemsForDisplay || basicItems

    const { guesses, guessesMax, triviaItem } = currentGame
    const correctItemId = triviaItem?.id ?? 0
    const completed = isCompletedGame(currentGame)

    const listData: ListItem[] = useMemo(() => {
      const max = guessesMax || 5
      if (isDataLoading) {
        return Array.from({ length: max }, (_, index) => ({
          type: "skeleton",
          index,
        }))
      }

      return guesses.map((guess, index) => ({ type: "guess", guess, index }))
    }, [isDataLoading, guesses, guessesMax])

    const renderListItem = useCallback(
      (item: ListItem) => {
        switch (item.type) {
          case "skeleton":
            return <SkeletonRow index={item.index} />
          case "guess": {
            const isLastGuess =
              !!lastGuessResult &&
              item.index === guesses.length - 1 &&
              lastGuessResult.itemId === item.guess.itemId
            return (
              <GuessRow
                index={item.index}
                guess={item.guess}
                basicItems={items}
                isLastGuess={isLastGuess}
                lastGuessResult={lastGuessResult}
                correctItemId={correctItemId}
              />
            )
          }
          default:
            return null
        }
      },
      [lastGuessResult, guesses.length, items, correctItemId]
    )

    // A game has at most five rows. Let text and feedback determine their height
    // inside the screen's ScrollView; an estimated list height clips large text.
    return (
      <View style={[styles.listWrapper, styles.container]}>
        {listData.map(item => <React.Fragment key={item.index}>{renderListItem(item)}</React.Fragment>)}
        {!completed && !isDataLoading && <Text accessibilityLiveRegion="polite" style={{ fontFamily: "PremiereSans", fontSize: 11, lineHeight: 16, letterSpacing: 1.5, color: colors.textSecondary, textAlign: "center", marginTop: 4 }}>{Math.max(0, (guessesMax || 5) - guesses.length)} GUESSES REMAINING</Text>}
      </View>
    )
  }
)

interface GuessesContainerStyles {
  listWrapper: ViewStyle
  container: ViewStyle
}

const themedStyles = (theme: Theme): GuessesContainerStyles => ({
  listWrapper: {
    width: "100%",
  },
  container: {
    paddingTop: 12,
    paddingBottom: theme.spacing.small,
  },
})

export default GuessesContainer
