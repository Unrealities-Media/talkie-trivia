export default interface PlayerStats {
  completedDays?: string[]
  allFiveDays?: string[]
  byDifficulty?: Partial<Record<import("../config/difficulty").DifficultyLevel, { games: number; wins: number; score: number }>>
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
