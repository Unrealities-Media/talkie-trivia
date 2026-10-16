export default interface PlayerStats {
  statisticsVersion?: number
  daysCompleted?: number
  allFiveCompleted?: number
  allFiveSolved?: number
  lastCompletedDate?: string | null
  serverNow?: string
  completedDays?: string[]
  allFiveDays?: string[]
  byDifficulty?: Partial<Record<import("../config/difficulty").DifficultyLevel, { games: number; wins: number; score: number; guesses?: number[]; gaveUp?: number }>>
  id: string
  currentStreak: number
  games: number
  maxStreak: number
  wins: number[]
  hintsAvailable: number
  hintsUsedCount: number
  lastStreakMessageDate?: string
  allTimeScore: number
}
