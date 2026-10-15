import { DifficultyLevel } from "../config/difficulty"
import { GameMode } from "./trivia"

export interface GameHistoryEntry {
  challengeId?: string
  dateId: string // YYYY-MM-DD
  itemId: number | string
  itemTitle: string
  posterPath: string
  wasCorrect: boolean
  gaveUp: boolean
  guessCount: number
  guessesMax: number
  difficulty: DifficultyLevel
  score: number
  gameMode: GameMode
}
