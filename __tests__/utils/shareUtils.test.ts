import {
  generateShareMessage,
  shareGameResult,
} from "../../src/utils/shareUtils"
import { Share } from "react-native"
import { analyticsService } from "../../src/utils/analyticsService"
import { hapticsService } from "../../src/utils/hapticsService"
import { defaultPlayerGame } from "../../src/models/default"
import { useGameStore } from "../../src/state/gameStore"
import { calculateScore } from "../../src/utils/scoreUtils"
import { PlayerGame, Guess } from "../../src/models/game"

// Mocks
jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" })
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/utils/hapticsService")
jest.mock("../../src/utils/scoreUtils")
jest.mock("../../src/state/gameStore", () => ({
  useGameStore: {
    getState: jest.fn(),
  },
}))

describe("Utils: shareUtils", () => {
  const mockDate = new Date("2023-01-01T12:00:00.000Z")

  // Correctly typed mock guesses
  const mockGuesses: Guess[] = [{ itemId: 1 }, { itemId: 2 }]

  const baseGame: PlayerGame = {
    ...defaultPlayerGame,
    startDate: mockDate,
    guessesMax: 5,
    guesses: mockGuesses,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(calculateScore as jest.Mock).mockReturnValue(1000)
    ;(useGameStore.getState as jest.Mock).mockReturnValue({
      gameMode: "movies",
    })
  })

  describe("generateShareMessage", () => {
    it("should generate a correct message for a Win", () => {
      const game = { ...baseGame, correctAnswer: true }
      const msg = generateShareMessage(game)

      expect(msg).toContain("Talkie Trivia 🎬")
      expect(msg).toContain("2023")
      expect(msg).toContain("✅ Guessed in 2/5 tries!")
      // 2 guesses total. First one wrong (red), last one correct (green).
      expect(msg).toContain("🟥🟩")
      expect(msg).toContain("Score: 🏆 1000")
    })

    it("should generate a correct message for a Loss", () => {
      const lossGuesses: Guess[] = [
        { itemId: 1 },
        { itemId: 2 },
        { itemId: 3 },
        { itemId: 4 },
        { itemId: 5 },
      ]
      const game = {
        ...baseGame,
        correctAnswer: false,
        gaveUp: false,
        guessesMax: 5,
        guesses: lossGuesses,
      }
      const msg = generateShareMessage(game)

      expect(msg).toContain("😢 Didn't guess the item!")
      expect(msg).toContain("🟥🟥🟥🟥🟥")
    })

    it("should generate a correct message for Giving Up", () => {
      const giveUpGuesses: Guess[] = [{ itemId: 1 }]
      const game = {
        ...baseGame,
        correctAnswer: false,
        gaveUp: true,
        guesses: giveUpGuesses,
      }
      const msg = generateShareMessage(game)

      expect(msg).toContain("🤔 Gave up after 1 guess.")
      expect(msg).toContain("🟥⏹️")
    })

    it("should adapt title based on Game Mode", () => {
      ;(useGameStore.getState as jest.Mock).mockReturnValue({
        gameMode: "videoGames",
      })
      const msg = generateShareMessage({ ...baseGame, correctAnswer: true })
      expect(msg).toContain("Talkie Trivia 🎮")
    })
  })

  describe("shareGameResult", () => {
    it("should call Share.share with correct parameters", async () => {
      const game = { ...baseGame, correctAnswer: true }
      await shareGameResult(game)

      expect(hapticsService.medium).toHaveBeenCalled()
      expect(analyticsService.trackShareResults).toHaveBeenCalledWith("win")
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Talkie Trivia"),
        }),
        expect.anything()
      )
    })

    it("should handle Share cancellation (AbortError) gracefully", async () => {
      const error = new Error("Share Canceled")
      error.name = "AbortError"
      ;(Share.share as jest.Mock).mockRejectedValue(error)

      await expect(shareGameResult(baseGame)).resolves.toBeUndefined()
    })

    it("should re-throw other errors", async () => {
      const error = new Error("Random Failure")
      ;(Share.share as jest.Mock).mockRejectedValue(error)

      await expect(shareGameResult(baseGame)).rejects.toThrow("Random Failure")
    })
  })
})
