jest.mock("firebase-functions/v2/https", () => ({ HttpsError: class extends Error {} }))
import { Game, completeStats, initialStats } from "./gameEngine"
import { calendars, chronologicalStats, effectiveStats, hydrate, summary } from "./statisticsStorage"

const game = (day: string, level = 2, win = true, legacy = false): Game => ({
  challengeId: legacy ? day : `${day}_LEVEL_${level}`, difficulty: `LEVEL_${level}`,
  correctAnswer: win, gaveUp: !win, guesses: win ? [{ itemId: 1 }] : [], score: win ? 550 : 0,
}) as Game

it("rebuilds legacy and new results identically in either arrival order", () => {
  const games = [game("2026-10-13", 2, false, true), game("2026-10-14")]
  const a = games.reduce(completeStats, initialStats("u"))
  const b = [...games].reverse().reduce(completeStats, initialStats("u"))
  expect(a).toEqual(b)
  expect(a).toMatchObject({ currentStreak: 2, daysCompleted: 2, byDifficulty: { LEVEL_2: { games: 2, wins: 1, gaveUp: 1 } } })
})

it("distinguishes five completed from five solved, including mixed outcomes", () => {
  const losses = [1, 2, 3, 4, 5].map(level => game("2026-10-13", level, false)).reduce(completeStats, initialStats("u"))
  expect(losses).toMatchObject({ games: 5, daysCompleted: 1, currentStreak: 1, allFiveCompleted: 1, allFiveSolved: 0 })
  const wins = [1, 2, 3, 4, 5].map(level => game("2026-10-14", level)).reduce(completeStats, losses)
  expect(wins).toMatchObject({ games: 10, daysCompleted: 2, currentStreak: 2, allFiveCompleted: 2, allFiveSolved: 1 })
  expect(wins.byDifficulty?.LEVEL_5?.guesses).toEqual([1, 0, 0])
  expect(wins.byDifficulty?.LEVEL_2?.guesses).toEqual([1, 0, 0, 0, 0])
})

it("does not substitute a legacy movie for one of the five published slots", () => {
  let stats = completeStats(initialStats("u"), game("2026-10-13", 2, true, true))
  stats = [1, 3, 4, 5].map(level => game("2026-10-13", level)).reduce(completeStats, stats)
  expect(stats).toMatchObject({ games: 5, daysCompleted: 1, allFiveCompleted: 0, allFiveSolved: 0 })
  stats = completeStats(stats, game("2026-10-13", 2))
  expect(stats).toMatchObject({ games: 6, daysCompleted: 1, allFiveCompleted: 1, allFiveSolved: 1 })
})

it("keeps the summary bounded and roundtrips leap-year calendar partitions", () => {
  let stats = initialStats("u")
  for (let i = 0; i < 800; i++) {
    const day = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)
    stats = completeStats(stats, game(day))
  }
  const buckets = calendars(stats)
  expect(buckets.get("2024")?.completedDays).toHaveLength(366)
  expect([...buckets.values()].every(bucket => bucket.completedDays.length <= 366)).toBe(true)
  expect(JSON.stringify(summary(stats)).length).toBeLessThan(1500)
  expect(hydrate(summary(stats), [...buckets.values()])).toEqual(stats)
})

it("expires a stored streak using UTC while leaving lifetime data intact", () => {
  const stats = completeStats(initialStats("u"), game("2026-10-13"))
  expect(effectiveStats(stats, new Date("2026-10-14T23:59:59Z")).currentStreak).toBe(1)
  expect(effectiveStats(stats, new Date("2026-10-15T00:00:00Z"))).toMatchObject({ currentStreak: 0, maxStreak: 1, games: 1 })
  expect(stats.currentStreak).toBe(1)
})

it("verifies multiple pages using only a single day's checkpoint", () => {
  const games = [game("2024-12-31", 2, false, true), ...[1, 2, 3, 4, 5].map(level => game("2025-01-01", level)), game("2025-01-03", 5, false)]
  const all = games.reduce(completeStats, initialStats("u"))
  const checkpoint = games.reduce(chronologicalStats, initialStats("u"))
  expect(summary(checkpoint)).toEqual(summary(all))
  expect(checkpoint.completedDays).toEqual(["2025-01-03"])
})
