import React from "react"
import { View, ViewStyle } from "react-native"
import CluesContainer from "./clues"
import GameplayView from "./gameplayView"
import GameOverView from "./gameOverView"
import GuessesContainer from "./guesses"
import { useGameStore } from "../state/gameStore"
import RevealSequence from "./revealSequence"
import { useStyles, Theme } from "../utils/hooks/useStyles"

const GameplayContainer: React.FC = () => {
  const playerGame = useGameStore((state) => state.playerGame)
  const lastGuessResult = useGameStore((state) => state.lastGuessResult)
  const gameStatus = useGameStore((state) => state.gameStatus)
  const completeRevealSequence = useGameStore(
    (state) => state.completeRevealSequence
  )
  const styles = useStyles(themedStyles)

  // Prepare the result and its artwork underneath the modal for its final dissolve.
  const showGameOverView = gameStatus === "gameOver" || gameStatus === "revealing"

  return (
    <View style={styles.container}>
      {showGameOverView ? (
        <GameOverView
          playerGame={playerGame}
          lastGuessResult={lastGuessResult}
        />
      ) : (
        <>
          <CluesContainer key={playerGame.id} />
          <GameplayView>
            <GuessesContainer lastGuessResult={lastGuessResult} />
          </GameplayView>
        </>
      )}

      {gameStatus === "revealing" && (
        <RevealSequence onAnimationComplete={completeRevealSequence} />
      )}
    </View>
  )
}

interface GameplayContainerStyles {
  container: ViewStyle
}

const themedStyles = (theme: Theme): GameplayContainerStyles => ({
  container: {
    alignItems: "center",
    flexGrow: 1,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    marginBottom: theme.spacing.extraLarge,
    paddingHorizontal: 0,
  },
})

export default GameplayContainer
