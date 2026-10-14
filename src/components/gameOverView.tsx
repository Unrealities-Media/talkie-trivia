import React from "react"
import { View, TextStyle, ViewStyle, useWindowDimensions, PixelRatio } from "react-native"
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
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"

interface GameOverViewProps {
  playerGame: PlayerGame
  lastGuessResult: { itemId: number | string; correct: boolean } | null
}

const GameOverView: React.FC<GameOverViewProps> = ({
  playerGame,
  lastGuessResult,
}) => {
  const styles = useStyles(themedStyles)
  const { width } = useWindowDimensions()
  const titleSize = PixelRatio.roundToNearestPixel(playerGame.gaveUp && !playerGame.correctAnswer
    ? Math.min(57, width * 0.125)
    : Math.min(69, width * 0.15))
  const resultTitle = playerGame.correctAnswer ? "That's a wrap!" : playerGame.gaveUp ? "Answer revealed" : "Out of guesses"
  const resultMessage = playerGame.correctAnswer
    ? `You guessed it in ${playerGame.guesses.length} guess${
        playerGame.guesses.length > 1 ? "es" : ""
      }!`
    : playerGame.gaveUp
    ? `You ended this game after ${playerGame.guesses.length} ${playerGame.guesses.length === 1 ? "guess" : "guesses"}.`
    : `You used all ${playerGame.guessesMax} guesses. Here's today's movie.`

  return (
    <Animated.View entering={FadeInDown.duration(650).reduceMotion(ReduceMotion.System)} style={{ width: "100%" }}>
      <Card style={styles.card}>
        <View style={styles.scrollContentContainer}>
          <Typography accessibilityRole="header" variant="h2" style={[styles.resultTitle, { fontSize: titleSize, lineHeight: PixelRatio.roundToNearestPixel(titleSize * 1.16) }]}>
            {resultTitle}
          </Typography>
          <Facts item={playerGame.triviaItem} isScrollEnabled={false}
            headerFooter={<Typography variant="body" style={styles.subText}>{resultMessage}</Typography>}
            posterFooter={<ShareResultButton playerGame={playerGame} />} />
          <ResultSummary game={playerGame} />

          <FullPlotSection overview={playerGame.triviaItem.description} />
        </View>
      </Card>

      <GuessesContainer lastGuessResult={lastGuessResult} />
      <PersonalizedStatsMessage />
      <CountdownTimer />
    </Animated.View>
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
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    width: "100%",
    marginVertical: 0,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
    alignItems: "center",
  },
  resultTitle: {
    color: theme.colors.textPrimary,
    fontFamily: "PremiereDisplay-Bold",
    fontSize: 58,
    lineHeight: 68,
    textAlign: "center",
    marginBottom: theme.spacing.extraSmall,
  },
  subText: {
    fontFamily: "PremiereSans",
    fontSize: 11,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: theme.spacing.large,
  },
})

export default GameOverView
