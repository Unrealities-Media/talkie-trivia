import React, { memo, useMemo, useCallback } from "react"
import { View, ViewStyle } from "react-native"
import { BasicTriviaItem } from "../models/trivia"
import { useGameStore } from "../state/gameStore"
import { HintInfo, PlayerGame, Guess } from "../models/game"
import { useShallow } from "zustand/react/shallow"
import { GuessRow } from "./guess/guessRow"
import { EmptyGuessTile } from "./guess/emptyGuessTile"
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
  | { type: "empty"; index: number }
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

      if (completed) return guesses.map((guess, index) => ({ type: "guess", guess, index }))

      const listItems: ListItem[] = []
      for (let i = 0; i < max; i++) {
        if (guesses[i]) {
          listItems.push({ type: "guess", guess: guesses[i], index: i })
        } else {
          listItems.push({ type: "empty", index: i })
        }
      }
      return listItems
    }, [isDataLoading, guesses, guessesMax, completed])

    const renderListItem = useCallback(
      (item: ListItem) => {
        switch (item.type) {
          case "skeleton":
            return <SkeletonRow index={item.index} />
          case "empty":
            return <EmptyGuessTile index={item.index} />
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
    paddingVertical: theme.spacing.small,
  },
})

export default GuessesContainer
