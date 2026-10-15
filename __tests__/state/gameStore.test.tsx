import { useGameStore } from "../../src/state/gameStore"
import { defaultPlayerGame, defaultPlayerStats } from "../../src/models/default"
import { gameService } from "../../src/services/gameService"
import { analyticsService } from "../../src/utils/analyticsService"
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/services/gameService")
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))
const initial = useGameStore.getState()
const movie = { id: 101, title: "The Matrix", releaseDate: "1999", posterPath: "", description: "Neo", metadata: {}, hints: [] }
const game = { ...defaultPlayerGame, playerID: "p1", triviaItem: movie, revision: 0, challengeId: "2026-10-13" }
const acknowledge = (changes: Partial<typeof game>) => {
  ;(gameService.applyAction as jest.Mock).mockResolvedValue({ challengeId: game.challengeId, receivedAtMonotonic: performance.now(), serverNow: "2026-10-13T00:00:00Z", resetAt: "2026-10-14T00:00:00Z", game: { ...game, ...changes }, stats: { ...defaultPlayerStats, id: "p1" } })
}
describe("gameplay presentation after server acknowledgment", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useGameStore.setState({ ...initial, loading: false, playerGame: game, fullItems: [movie], basicItems: [movie], isInteractionsDisabled: false }, true)
  })
  it("shows a confirmed win and its canonical score", async () => {
    acknowledge({ correctAnswer: true, guesses: [{ itemId: 101 }], statsProcessed: true, score: 700 })
    await useGameStore.getState().makeGuess(movie)
    expect(useGameStore.getState()).toMatchObject({ showConfetti: true, isInteractionsDisabled: true, playerGame: { score: 700 } })
    expect(analyticsService.trackGuessMade).toHaveBeenCalledWith(1, true, 101, "The Matrix")
  })
  it("displays the saved wrong guess without ending the game", async () => {
    acknowledge({ guesses: [{ itemId: 999 }] })
    await useGameStore.getState().makeGuess({ ...movie, id: 999 })
    expect(useGameStore.getState()).toMatchObject({ isInteractionsDisabled: false, lastGuessResult: { correct: false }, playerGame: { guesses: [{ itemId: 999 }] } })
  })
  it("does not send guesses after completion", async () => {
    useGameStore.setState({ playerGame: { ...game, correctAnswer: true } })
    await useGameStore.getState().makeGuess(movie)
    expect(gameService.applyAction).not.toHaveBeenCalled()
  })
  it("shows the remaining per-game hints after a confirmed spend", async () => {
    acknowledge({ difficulty: "LEVEL_2", hintsUsed: { director: true } })
    await useGameStore.getState().useHint("director")
    expect(useGameStore.getState().playerStats.hintsAvailable).toBe(2)
    expect(analyticsService.trackHintUsed).toHaveBeenCalledWith("director", 0, 2)
  })
  it("does not reveal a rejected hint", async () => {
    ;(gameService.applyAction as jest.Mock).mockRejectedValue(new Error("This hint is not available."))
    await useGameStore.getState().useHint("director")
    expect(useGameStore.getState().playerGame.hintsUsed?.director).toBeUndefined()
  })
  it("ends play after an acknowledged give-up", async () => {
    acknowledge({ gaveUp: true, statsProcessed: true })
    await useGameStore.getState().giveUp()
    expect(useGameStore.getState()).toMatchObject({ gameStatus: "revealing", isInteractionsDisabled: true })
    expect(analyticsService.trackGameGiveUp).toHaveBeenCalledWith(0, 0)
  })
})
