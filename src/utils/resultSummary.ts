import { PlayerGame } from "../models/game"

export function isCompletedGame(game: PlayerGame): boolean {
  return game.correctAnswer || game.gaveUp || game.guesses.length >= game.guessesMax
}

export function savedScore(game: PlayerGame): number | null {
  return isCompletedGame(game) && game.statsProcessed === true &&
    typeof game.score === "number" && Number.isSafeInteger(game.score) && game.score >= 0
    ? game.score : null
}

export function challengeDay(game: PlayerGame): string | null {
  // The challenge's UTC day survives delayed saves and changes of timezone.
  if (game.challengeId !== undefined) {
    const day = game.challengeId
    const time = Date.parse(`${day}T00:00:00Z`)
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === day ? day : null
  }
  const time = new Date(game.startDate).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null
}

export function manualHintsUsed(game: PlayerGame): number {
  return game.difficulty === "LEVEL_2"
    ? Object.values(game.hintsUsed || {}).filter(Boolean).length : 0
}
