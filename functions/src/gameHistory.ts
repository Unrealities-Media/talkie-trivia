import { Game } from "./gameEngine"

/** The same immutable result shape is used for play and account migration. */
export function gameHistory(game: Game) {
  return {
    dateId: game.challengeId, itemId: game.answerId, itemTitle: game.triviaItem.title,
    posterPath: game.triviaItem.posterPath, wasCorrect: game.correctAnswer, gaveUp: game.gaveUp,
    guessCount: game.guesses.length, guessesMax: game.guessesMax, difficulty: game.difficulty,
    score: game.score, gameMode: "movies", createdAt: game.endDate, schemaVersion: 2,
  }
}
