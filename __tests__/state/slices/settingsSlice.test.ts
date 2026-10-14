import { useGameStore } from "../../../src/state/gameStore"
import { defaultPlayerGame } from "../../../src/models/default"
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))
const initial = useGameStore.getState()
describe("next-game preferences", () => {
  beforeEach(() => useGameStore.setState(initial, true))
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
