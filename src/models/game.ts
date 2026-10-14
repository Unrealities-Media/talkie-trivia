import { TriviaItem } from "./trivia"
import { DifficultyLevel } from "../config/difficulty"

export type Difficulty = DifficultyLevel
export type HintType = string

export interface HintInfo {
  type: string
  value: any
  label: string
}

export interface Guess {
  itemId: number | string
  hintInfo?: HintInfo[] | null
}

export interface PlayerGame {
  challengeId?: string
  revision?: number
  score?: number
  id: string
  playerID: string
  triviaItem: TriviaItem
  guessesMax: number
  difficulty: DifficultyLevel
  guesses: Guess[]
  correctAnswer: boolean
  gaveUp: boolean
  startDate: Date
  endDate: Date
  hintsUsed?: Partial<Record<string, boolean>>
  statsProcessed?: boolean
}
