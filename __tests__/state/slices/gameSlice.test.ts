import { useGameStore } from "../../../src/state/gameStore"
import { gameService } from "../../../src/services/gameService"
import { defaultPlayerGame, defaultPlayerStats } from "../../../src/models/default"
import AsyncStorage from "@react-native-async-storage/async-storage"
jest.mock("../../../src/services/gameService", () => ({ gameService: { startGame: jest.fn(), applyAction: jest.fn(), resumePendingAction: jest.fn() } }))
jest.mock("../../../src/services/movieDataService", () => ({ MovieDataService: class { getCatalogLists() { return { basicItems: [], fullItems: [] } } } }))
jest.mock("../../../src/utils/analyticsService")
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))
const initial = useGameStore.getState()
const game = { ...defaultPlayerGame, id: "movies_2026-10-13", playerID: "p1", challengeId: "2026-10-13", revision: 0 }
const response = { game, stats: { ...defaultPlayerStats, id: "p1" }, challengeId: "2026-10-13", resetAt: "2026-10-14T00:00:00Z", serverNow: "2026-10-13T00:00:00Z", receivedAtMonotonic: 100 }
describe("authoritative game state", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(performance, "now").mockReturnValue(100); useGameStore.getState().resetSession(); useGameStore.setState(initial, true); (gameService.startGame as jest.Mock).mockResolvedValue(response) })
  afterEach(() => jest.restoreAllMocks())
  it("opens the daily game when optional tutorial preference reads fail", async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Tutorial storage unavailable"))
      .mockRejectedValueOnce(new Error("Tutorial storage unavailable"))
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    expect(gameService.startGame).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState()).toMatchObject({ loading: false, error: null, playerGame: { id: game.id }, tutorialState: { showGuessInputTip: true, showResultsTip: true } })
  })
  it("restores the saved difficulty instead of overwriting it with preferences", async () => {
    ;(gameService.startGame as jest.Mock).mockResolvedValue({ ...response, game: { ...game, difficulty: "LEVEL_5", guessesMax: 3, guesses: [{ itemId: 2 }] } })
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    expect(useGameStore.getState().difficulty).toBe("LEVEL_5")
    expect(useGameStore.getState().playerGame.guesses).toHaveLength(1)
  })
  it("does not mark a failed move completed or optimistically award statistics", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    ;(gameService.applyAction as jest.Mock).mockRejectedValue(new Error("offline"))
    await useGameStore.getState().makeGuess({ id: 1, title: "Answer", posterPath: "", releaseDate: "1999" })
    expect(useGameStore.getState()).toMatchObject({ syncStatus: "pending", error: null, playerGame: { statsProcessed: false, guesses: [] }, playerStats: { games: 0 } })
    ;(gameService.resumePendingAction as jest.Mock).mockResolvedValue({ ...response, game: { ...game, guesses: [{ itemId: 1 }], correctAnswer: true, statsProcessed: true, score: 700, revision: 1 }, stats: { ...response.stats, games: 1, allTimeScore: 700 } })
    await useGameStore.getState().retryPendingAction()
    expect(useGameStore.getState()).toMatchObject({ syncStatus: "idle", gameStatus: "revealing", playerGame: { score: 700, statsProcessed: true }, playerStats: { games: 1 } })
  })
  it("ignores double taps while saving", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    let finish!: (data: unknown) => void
    ;(gameService.applyAction as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const first = useGameStore.getState().giveUp()
    await useGameStore.getState().giveUp()
    expect(gameService.applyAction).toHaveBeenCalledTimes(1)
    finish(response)
    await first
  })
  it("does not enqueue a previously acknowledged guess or consume another attempt", async () => {
    ;(gameService.startGame as jest.Mock).mockResolvedValue({ ...response, game: { ...game, guesses: [{ itemId: 2 }] } })
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    await useGameStore.getState().makeGuess({ id: "2", title: "Repeated", posterPath: "", releaseDate: "2000" })
    expect(gameService.applyAction).not.toHaveBeenCalled()
    expect(useGameStore.getState()).toMatchObject({ syncStatus: "idle", syncError: null, playerGame: { guesses: [{ itemId: 2 }] } })
  })
  it("ignores a stale response when the account changes", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    let finish!: (data: unknown) => void
    ;(gameService.applyAction as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = useGameStore.getState().giveUp()
    ;(gameService.startGame as jest.Mock).mockResolvedValue({ ...response, game: { ...game, playerID: "p2" } })
    await useGameStore.getState().initializeGame({ id: "p2", name: "Other" })
    finish(response)
    await pending
    expect(useGameStore.getState().playerGame.playerID).toBe("p2")
  })
  it("keeps an actionable initialization error with no endless loading", async () => {
    ;(gameService.startGame as jest.Mock).mockRejectedValue(new Error("Challenge unavailable"))
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    expect(useGameStore.getState()).toMatchObject({ loading: false, error: "Challenge unavailable", isInteractionsDisabled: true })
  })
  it("clears account data and rejects in-flight moves immediately on sign-out", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    let finish!: (data: unknown) => void
    ;(gameService.applyAction as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = useGameStore.getState().giveUp()
    useGameStore.getState().resetSession()
    expect(useGameStore.getState().playerGame.playerID).not.toBe("p1")
    finish(response)
    await pending
    expect(useGameStore.getState().playerGame.playerID).not.toBe("p1")
    expect(useGameStore.getState()).toMatchObject({ isInteractionsDisabled: true, showModal: false, syncStatus: "idle" })
  })
  it("refreshes at the server deadline before accepting a new old-day move", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    expect(useGameStore.getState().resetDeadline).toBe(86400100)
    useGameStore.setState({ resetDeadline: 0 })
    await useGameStore.getState().giveUp()
    expect(gameService.applyAction).not.toHaveBeenCalled()
    expect(gameService.startGame).toHaveBeenCalledTimes(2)
  })
  it("preserves account statistics when today's content cannot refresh", async () => {
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    useGameStore.setState({ playerStats: { ...response.stats, games: 18 } })
    ;(gameService.startGame as jest.Mock).mockRejectedValue(new Error("No content"))
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    expect(useGameStore.getState()).toMatchObject({ playerStats: { games: 18 }, error: "No content", loading: false, isInteractionsDisabled: true })
  })
  it("deduplicates concurrent initial and foreground refreshes", async () => {
    let finish!: (data: unknown) => void
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    ;(gameService.startGame as jest.Mock).mockImplementation(() => { started(); return new Promise(resolve => { finish = resolve }) })
    const first = useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    await useGameStore.getState().initializeGame({ id: "p1", name: "Player" })
    await ready
    expect(gameService.startGame).toHaveBeenCalledTimes(1)
    finish(response)
    await first
  })
})
