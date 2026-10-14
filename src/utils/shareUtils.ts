import { Share } from "react-native"
import { PlayerGame } from "../models/game"
import { analyticsService } from "./analyticsService"
import { hapticsService } from "./hapticsService"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { challengeDay, manualHintsUsed, savedScore } from "./resultSummary"

export const generateShareMessage = (game: PlayerGame): string => {
  const day = challengeDay(game)
  const score = savedScore(game)
  const mode = DIFFICULTY_MODES[game.difficulty]
  if (!day || score === null || !mode || game.guesses.length > game.guessesMax ||
      (game.correctAnswer && game.guesses.length === 0)) {
    throw new Error("A saved, completed result is needed before sharing.")
  }
  const count = game.guesses.length
  const result = game.correctAnswer
    ? `Solved in ${count}/${game.guessesMax} guesses`
    : game.gaveUp ? `Gave up after ${count} ${count === 1 ? "guess" : "guesses"}`
      : `Out of guesses (${count}/${game.guessesMax})`
  const grid = game.correctAnswer ? "🟥".repeat(count - 1) + "🟩"
    : "🟥".repeat(count) + (game.gaveUp ? "⏹️" : "")
  const hintLine = game.difficulty === "LEVEL_2" ? `\nHints used: ${manualHintsUsed(game)}/3` : ""
  // Text-only until an owned public destination is configured and verified.
  // No answer, cast, plot, guessed titles, account IDs, or mutable store values.
  return `Talkie Trivia 🎬\n${day} (UTC) · ${mode.label}\n${result}\n${grid}\nScore: ${score}${hintLine}`
}

let sharing = false
export const shareGameResult = async (game: PlayerGame): Promise<void> => {
  if (sharing) return
  const message = generateShareMessage(game)
  const outcome = game.correctAnswer ? "win" : game.gaveUp ? "give_up" : "lose"
  sharing = true
  try {
    hapticsService.medium()
    const result = await Share.share({ message, title: "Talkie Trivia Results" }, {
      dialogTitle: "Share your Talkie Trivia results!",
    })
    // This is the platform-reported result, not proof that a recipient received it.
    if (result.action === Share.sharedAction) analyticsService.trackShareResults(outcome)
  } catch (error: unknown) {
    if (error && typeof error === "object" && (
      ("name" in error && error.name === "AbortError") ||
      ("message" in error && typeof error.message === "string" && /share cancel(?:l?ed)/i.test(error.message))
    )) return
    throw error
  } finally {
    sharing = false
  }
}
