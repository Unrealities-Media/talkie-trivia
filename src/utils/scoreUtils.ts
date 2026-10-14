import { PlayerGame } from "../models/game"
import { DIFFICULTY_MODES } from "../config/difficulty"

const MAX_SCORE = 1000
const HINT_PENALTY = 50

export function calculateScore(playerGame: PlayerGame): number {
  if (playerGame.statsProcessed && typeof playerGame.score === "number") return playerGame.score
  if (!playerGame.correctAnswer) {
    return 0
  }

  const { difficulty, guesses, guessesMax, hintsUsed } = playerGame
  const guessesUsed = guesses.length

  const difficultyMode = DIFFICULTY_MODES[difficulty]
  if (!difficultyMode) {
    console.error(
      `Invalid difficulty: ${difficulty} found in score calculation.`
    )
    return 0
  }

  // 1. Determine the maximum possible score for this difficulty (a 1-guess win).
  const maxScoreForDifficulty = MAX_SCORE * difficultyMode.scoreMultiplier

  // 2. Determine the pool of points available for performance.
  const performancePointsPool =
    maxScoreForDifficulty * difficultyMode.scoreRangePercentage

  // 3. The base score is the minimum you get for winning (i.e., on the last guess).
  const baseWinPoints = maxScoreForDifficulty - performancePointsPool

  // 4. Calculate a performance factor (0.0 for last guess, 1.0 for first guess).
  // Avoid division by zero if guessesMax is 1.
  const performanceFactor =
    guessesMax > 1 ? (guessesMax - guessesUsed) / (guessesMax - 1) : 1
  const earnedPerformancePoints = performancePointsPool * performanceFactor

  // 5. Calculate hint penalties (only applicable in Easy mode).
  let hintPenaltyTotal = 0
  if (difficulty === "LEVEL_2" && hintsUsed) {
    const manualHintsCount = Object.values(hintsUsed).filter(Boolean).length
    hintPenaltyTotal = manualHintsCount * HINT_PENALTY
  }

  // 6. Final score is the base for winning + performance bonus - penalties.
  const finalScore = Math.max(
    0,
    Math.round(baseWinPoints + earnedPerformancePoints - hintPenaltyTotal)
  )

  return finalScore
}
