import { playerStatsConverter } from "../../../../src/utils/firestore/converters/playerStats"
import PlayerStats from "../../../../src/models/playerStats"

describe("Firestore Converter: PlayerStats", () => {
  const mockStats: PlayerStats = {
    id: "player-1",
    statisticsVersion: 3, daysCompleted: 5, allFiveCompleted: 1, allFiveSolved: 0, byDifficulty: {}, lastCompletedDate: "2023-01-01",
    currentStreak: 5,
    games: 10,
    maxStreak: 5,
    wins: [0, 1, 2, 3, 4],
    hintsAvailable: 10,
    hintsUsedCount: 2,
    lastStreakMessageDate: "2023-01-01",
    allTimeScore: 1000,
  }

  describe("toFirestore", () => {
    it("should pass through all fields correctly", () => {
      const result = playerStatsConverter.toFirestore(mockStats)
      expect(result).toEqual(mockStats)
    })

    it("should handle null/undefined lastStreakMessageDate by setting null", () => {
      const stats = { ...mockStats, lastStreakMessageDate: undefined }
      // @ts-ignore
      const result = playerStatsConverter.toFirestore(stats)
      // Firestore requires null, not undefined
      expect(result.lastStreakMessageDate).toBeNull()
    })

    it("should default allTimeScore to 0 if missing", () => {
      const stats = { ...mockStats, allTimeScore: undefined }
      // @ts-ignore
      const result = playerStatsConverter.toFirestore(stats)
      expect(result.allTimeScore).toBe(0)
    })
  })

  describe("fromFirestore", () => {
    it("should map fields correctly", () => {
      const snapshot = {
        data: () => mockStats,
      }
      // @ts-ignore
      const result = playerStatsConverter.fromFirestore(snapshot, {})
      expect(result).toEqual(mockStats)
    })

    it("should apply default values for missing fields", () => {
      const snapshot = {
        data: () => ({
          id: "player-1",
          currentStreak: 0,
          games: 0,
          maxStreak: 0,
          wins: [0, 0, 0, 0, 0],
          // Missing hintsAvailable, hintsUsedCount, allTimeScore
        }),
      }

      // @ts-ignore
      const result = playerStatsConverter.fromFirestore(snapshot, {})
      expect(result.hintsAvailable).toBe(3) // Default
      expect(result.hintsUsedCount).toBe(0) // Default
      expect(result.allTimeScore).toBe(0) // Default
      expect(result.lastStreakMessageDate).toBeUndefined()
    })
  })
})
