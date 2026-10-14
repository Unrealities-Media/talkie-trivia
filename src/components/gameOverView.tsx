import React from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import CountdownTimer from "./countdownTimer"
import Facts from "./facts"
import PersonalizedStatsMessage from "./personalizedStatsMessage"
import { PlayerGame } from "../models/game"
import GuessesContainer from "./guesses"
import FullPlotSection from "./gameOver/fullPlotSection"
import ShareResultButton from "./gameOver/shareResultButton"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Card } from "./ui/card"
import { Typography } from "./ui/typography"
import ResultSummary from "./gameOver/resultSummary"

interface GameOverViewProps {
  playerGame: PlayerGame
  lastGuessResult: { itemId: number | string; correct: boolean } | null
}

const GameOverView: React.FC<GameOverViewProps> = ({
  playerGame,
  lastGuessResult,
}) => {
  const styles = useStyles(themedStyles)
  const resultTitle = playerGame.correctAnswer ? "You Got It!" : playerGame.gaveUp ? "Answer revealed" : "Out of guesses"
  const resultMessage = playerGame.correctAnswer
    ? `You guessed it in ${playerGame.guesses.length} guess${
        playerGame.guesses.length > 1 ? "es" : ""
      }!`
    : playerGame.gaveUp
    ? `You ended this game after ${playerGame.guesses.length} ${playerGame.guesses.length === 1 ? "guess" : "guesses"}.`
    : `You used all ${playerGame.guessesMax} guesses. Here's today's movie.`

  return (
    <View style={{ width: "100%" }}>
      <Card style={styles.card}>
        <View style={styles.scrollContentContainer}>
          <Typography accessibilityRole="header" variant="h2" style={styles.resultTitle}>
            {resultTitle}
          </Typography>
          <Typography variant="body" style={styles.subText}>
            {resultMessage}
          </Typography>

          <ResultSummary game={playerGame} />
          <ShareResultButton playerGame={playerGame} />
          <Facts item={playerGame.triviaItem} isScrollEnabled={false} />

          <FullPlotSection overview={playerGame.triviaItem.description} />
        </View>
      </Card>

      <GuessesContainer lastGuessResult={lastGuessResult} />
      <PersonalizedStatsMessage />
      <CountdownTimer />
    </View>
  )
}

interface GameOverStyles {
  card: ViewStyle
  scrollContentContainer: ViewStyle
  resultTitle: TextStyle
  subText: TextStyle
}

const themedStyles = (theme: Theme): GameOverStyles => ({
  card: {
    width: "100%",
    marginVertical: theme.spacing.medium,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
  scrollContentContainer: {
    padding: theme.spacing.large,
    alignItems: "center",
  },
  resultTitle: {
    color: theme.colors.accentText,
    textAlign: "center",
    marginBottom: theme.spacing.extraSmall,
  },
  subText: {
    fontFamily: "Arvo-Italic",
    textAlign: "center",
    marginBottom: theme.spacing.large,
  },
})

export default GameOverView
