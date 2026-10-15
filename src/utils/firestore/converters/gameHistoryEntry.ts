import { GameHistoryEntry } from "../../../models/gameHistory"
import { Timestamp } from "firebase/firestore"
import { DEFAULT_DIFFICULTY } from "../../../config/difficulty"

export const gameHistoryEntryConverter = {
  toFirestore: (entry: GameHistoryEntry) => {
    return {
      dateId: entry.dateId,
      itemId: entry.itemId,
      itemTitle: entry.itemTitle,
      posterPath: entry.posterPath,
      wasCorrect: entry.wasCorrect,
      gaveUp: entry.gaveUp,
      guessCount: entry.guessCount,
      guessesMax: entry.guessesMax,
      difficulty: entry.difficulty,
      score: entry.score,
      gameMode: entry.gameMode || "movies",
      createdAt: Timestamp.now(),
    }
  },
  fromFirestore: (snapshot: any, options: any): GameHistoryEntry => {
    const data = snapshot.data(options)
    return {
      dateId: data.dateId,
      challengeId: snapshot.id ?? data.dateId,
      itemId: data.itemId || data.movieId,
      itemTitle: data.itemTitle || data.movieTitle,
      posterPath: data.posterPath,
      wasCorrect: data.wasCorrect,
      gaveUp: data.gaveUp,
      guessCount: data.guessCount,
      guessesMax: data.guessesMax,
      difficulty: data.difficulty || DEFAULT_DIFFICULTY,
      score: data.score || 0,
      gameMode: data.gameMode || "movies",
    }
  },
}
