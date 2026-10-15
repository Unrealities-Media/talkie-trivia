import { useGameStore } from "../../../src/state/gameStore"
import { defaultPlayerGame } from "../../../src/models/default"
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))
const initial = useGameStore.getState()
describe("daily challenge selection", () => {
  beforeEach(() => useGameStore.setState({ ...initial, loading: false }, true))
  it("opens the selected challenge without mutating the current snapshot", () => {
    const initializeGame = jest.fn()
    const game = { ...defaultPlayerGame, playerID: 'player', difficulty: 'LEVEL_3' as const }
    useGameStore.setState({ playerGame: game, initializeGame })
    useGameStore.getState().setDifficulty('LEVEL_4')
    expect(initializeGame).toHaveBeenCalledWith({ id: 'player', name: 'Player' }, 'LEVEL_4')
    expect(useGameStore.getState().playerGame).toBe(game)
  })
  it.each(['saving', 'pending'] as const)('blocks switching during %s', syncStatus => {
    const initializeGame = jest.fn()
    useGameStore.setState({ syncStatus, initializeGame, nextDifficulty: 'LEVEL_3' })
    useGameStore.getState().setDifficulty('LEVEL_4')
    expect(initializeGame).not.toHaveBeenCalled()
    expect(useGameStore.getState().nextDifficulty).toBe('LEVEL_3')
  })
  it("cannot alter an active or finished game's difficulty, limit or score", () => {
    const game = { ...defaultPlayerGame, difficulty: "LEVEL_5" as const, guessesMax: 3, correctAnswer: true, score: 1000, statsProcessed: true }
    useGameStore.setState({ playerGame: game, difficulty: "LEVEL_5" })
    useGameStore.getState().setDifficulty("LEVEL_1")
    expect(useGameStore.getState().playerGame).toEqual(game)
    expect(useGameStore.getState().difficulty).toBe("LEVEL_5")
    expect(useGameStore.getState().nextDifficulty).toBe("LEVEL_1")
  })
  it("keeps unimplemented modes out of release play", async () => {
    await useGameStore.getState().setGameMode("videoGames")
    expect(useGameStore.getState().gameMode).toBe("movies")
  })
})
