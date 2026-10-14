jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))
import { completeStats, initialStats, parseAction, parseStart, matchingHints, Game, CatalogMovie } from "./gameEngine"
describe("strict command validation", () => {
  const valid = { challengeId: "2026-10-13", expectedRevision: 0, actionId: "action-id-1234567", type: "guess", itemId: 1 }
  test.each([null, [], "payload", { ...valid, challengeId: "2026-02-31" }, { ...valid, itemId: -1 }, { ...valid, itemId: 1.5 }, { ...valid, expectedRevision: 1e9 }, { ...valid, actionId: "../victim" }, { ...valid, score: 1000 }, { ...valid, difficulty: "LEVEL_5" }, { ...valid, hintType: "actors" }])("rejects malformed or overprivileged payload %j", data => {
    expect(() => parseAction(data)).toThrow()
  })
  it("does not accept inherited difficulty property names", () => {
    expect(() => parseStart({ difficulty: "constructor", catalogVersion: "a".repeat(64) })).toThrow()
  })
})
describe("daily statistics", () => {
  const result = (day: string, win = true) => ({ challengeId: day, correctAnswer: win, guesses: [{ itemId: 1 }], score: win ? 700 : 0 }) as Game
  it("breaks streaks on missed days and losses", () => {
    let stats = completeStats(initialStats("user"), result("2026-10-10"))
    stats = completeStats(stats, result("2026-10-11"))
    expect(stats.currentStreak).toBe(2)
    stats = completeStats(stats, result("2026-10-13"))
    expect(stats.currentStreak).toBe(1)
    expect(stats.maxStreak).toBe(2)
    stats = completeStats(stats, result("2026-10-14", false))
    expect(stats.currentStreak).toBe(0)
  })
  it("handles completion requests arriving out of calendar order", () => {
    let stats = completeStats(initialStats("user"), result("2026-10-13"))
    stats = completeStats(stats, result("2026-10-12"))
    expect(stats.currentStreak).toBe(2)
    expect(stats.lastCompletedDate).toBe("2026-10-13")
  })
})
describe("cast matching", () => {
  const movie = (cast: string[]) => ({ i: 1, t: "Movie", y: "", p: "", d: "N/A", c: cast, g: [] }) as CatalogMovie
  it("does not treat missing person IDs or missing metadata as matches", () => {
    expect(matchingHints(movie(["Alice"]), movie(["Bob"]))).toEqual([])
    expect(matchingHints(movie([]), movie([]))).toEqual([])
    expect(matchingHints(movie(["Alice"]), movie([" ALICE "]))).toEqual(["actors"])
  })
})
