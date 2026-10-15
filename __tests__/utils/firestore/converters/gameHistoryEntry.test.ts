import { gameHistoryEntryConverter } from "../../../../src/utils/firestore/converters/gameHistoryEntry"
import { GameHistoryEntry } from "../../../../src/models/gameHistory"

describe("Firestore Converter: GameHistoryEntry", () => {
  const mockEntry: GameHistoryEntry = {
    dateId: "2023-01-01",
    itemId: 123,
    itemTitle: "Test Movie",
    posterPath: "/path.jpg",
    wasCorrect: true,
    gaveUp: false,
    guessCount: 3,
    guessesMax: 5,
    difficulty: "LEVEL_3",
    score: 500,
    gameMode: "movies",
  }

  describe("toFirestore", () => {
    it("should correctly map model to firestore object", () => {
      const result = gameHistoryEntryConverter.toFirestore(mockEntry)

      expect(result).toEqual(
        expect.objectContaining({
          dateId: "2023-01-01",
          itemId: 123,
          score: 500,
          gameMode: "movies",
        })
      )
      // Check that Timestamp.now() was called (we can check property existence in our mock)
      expect(result.createdAt).toBeDefined()
    })

    it("should default gameMode to movies if missing", () => {
      const entry = { ...mockEntry, gameMode: undefined }
      // @ts-ignore
      const result = gameHistoryEntryConverter.toFirestore(entry)
      expect(result.gameMode).toBe("movies")
    })
  })

  describe("fromFirestore", () => {
    it.each(['LEVEL_1', 'LEVEL_5'])('preserves the %s document identity when dates match', level => {
      const snapshot = { id: `2023-01-01_${level}`, data: () => ({ ...mockEntry, difficulty: level }) }
      const result = gameHistoryEntryConverter.fromFirestore(snapshot as any, {})
      expect(result.dateId).toBe('2023-01-01')
      expect(result.challengeId).toBe(`2023-01-01_${level}`)
    })
    it("should correctly map firestore data to model", () => {
      const snapshot = {
        data: () => ({
          dateId: "2023-01-01",
          itemId: 123,
          itemTitle: "Test Movie",
          posterPath: "/path.jpg",
          wasCorrect: true,
          gaveUp: false,
          guessCount: 3,
          guessesMax: 5,
          difficulty: "LEVEL_3",
          score: 500,
          gameMode: "movies",
        }),
      }

      // @ts-ignore
      const result = gameHistoryEntryConverter.fromFirestore(snapshot, {})
      expect(result).toEqual({ ...mockEntry, challengeId: mockEntry.dateId })
    })

    it("should handle legacy field names (movieId vs itemId)", () => {
      const snapshot = {
        data: () => ({
          dateId: "2023-01-01",
          movieId: 999, // Legacy field
          movieTitle: "Legacy Title", // Legacy field
          posterPath: "/path.jpg",
          wasCorrect: true,
          gaveUp: false,
          guessCount: 1,
          guessesMax: 5,
        }),
      }

      // @ts-ignore
      const result = gameHistoryEntryConverter.fromFirestore(snapshot, {})
      expect(result.itemId).toBe(999)
      expect(result.itemTitle).toBe("Legacy Title")
    })

    it("should provide default values for missing fields", () => {
      const snapshot = {
        data: () => ({
          dateId: "2023-01-01",
        }),
      }

      // @ts-ignore
      const result = gameHistoryEntryConverter.fromFirestore(snapshot, {})
      expect(result.score).toBe(0)
      expect(result.difficulty).toBe("LEVEL_3") // Default
      expect(result.gameMode).toBe("movies")
    })
  })
})
