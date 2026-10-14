// Policy tests do not initialize Functions/Admin; HTTP/Auth behavior belongs in
// the real emulator contracts, as with the existing game-engine unit suite.
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))
import { planAccountMergePage, MergeGame, MERGE_PAGE_SIZE } from "./accountMergePolicy"
import { CatalogMovie, Game, GameAction, Stats, completeStats, hints, initialStats, transition } from "./gameEngine"
import { DIFFICULTY_MODES, DifficultyLevel } from "./utils/difficulty"
import { gameHistory } from "./gameHistory"

const sourceUid = "guest-with-hyphens"
const targetUid = "linked-profile"
const answer: CatalogMovie = { i: 1, t: "Answer", y: "1999", p: "/poster.jpg", d: "Director", c: ["Actor"], g: ["Drama"] }
const catalog = new Map<number, CatalogMovie>([
  [1, answer],
  ...[2, 3, 4, 5, 6].map(i => [i, { ...answer, i, t: `Other ${i}` }] as [number, CatalogMovie]),
])
function fresh(day = "2026-10-13", uid = sourceUid, difficulty: DifficultyLevel = "LEVEL_2"): MergeGame {
  return {
    schemaVersion: 2, scoringVersion: 1, id: `movies_${day}`, challengeId: day,
    playerID: uid, gameMode: "movies", difficulty, guessesMax: DIFFICULTY_MODES[difficulty].guessesMax,
    guesses: [], answerId: 1, correctAnswer: false, gaveUp: false, hintsUsed: {}, revision: 0,
    actions: [], startDate: `${day}T12:00:00.000Z`, endDate: `${day}T12:00:00.000Z`,
    statsProcessed: false, score: 0,
    triviaItem: { id: 1, title: answer.t, description: "Original immutable clue.", posterPath: answer.p,
      releaseDate: answer.y, metadata: {}, hints: hints(answer) },
  }
}
function act(game: MergeGame, action: Partial<GameAction> = { type: "guess", itemId: 1 }): MergeGame {
  return transition(game, {
    challengeId: game.challengeId, expectedRevision: game.revision, actionId: `action-number-${game.revision.toString().padStart(4, "0")}`,
    type: "guess", ...action,
  }, catalog, new Date(`${game.challengeId}T13:00:00.000Z`))
}
function merge(sourceGames: MergeGame[], destinations: MergeGame[] = [], targetStats = initialStats(targetUid)) {
  return planAccountMergePage({ sourceUid, targetUid, sourceGames,
    destinationGames: new Map(sourceGames.map(game => [game.id, destinations.find(other => other.id === game.id)])), targetStats })
}
function statsFor(...games: Game[]): Stats {
  return games.reduce((stats, game) => game.statsProcessed ? completeStats(stats, game) : stats, initialStats(targetUid))
}

it("preserves a partly played game's exact attempts, hints, action IDs and immutable content", () => {
  let source = act(fresh(), { type: "hint", hintType: "director" })
  source = act(source, { type: "guess", itemId: 2 })
  const original = structuredClone(source)
  const plan = merge([source])
  const migrated = plan.writes[0].game!
  expect(plan).toMatchObject({ imported: 1, conflicts: 0, stats: { games: 0, hintsUsedCount: 1, allTimeScore: 0 } })
  expect(migrated).toEqual({ ...source, playerID: targetUid, mergeOrigin: { guestUid: sourceUid, revision: 2, policyVersion: 1 } })
  expect(plan.writes[0].history).toBeUndefined()
  const completed = act(migrated)
  expect(completed.guesses).toEqual([{ itemId: 2 }, { itemId: 1 }])
  expect(completed.score).toBe(act(source).score)
  expect(source).toEqual(original)
})

it("does not restore spent hints or extra attempts after an imported game resumes", () => {
  let game = fresh()
  for (const hintType of ["director", "genre", "actors"] as const) game = act(game, { type: "hint", hintType })
  for (const itemId of [2, 3, 4, 5]) game = act(game, { type: "guess", itemId })
  const migrated = merge([game]).writes[0].game!
  expect(() => act(migrated, { type: "hint", hintType: "decade" })).toThrow("not available")
  const lost = act(migrated, { type: "guess", itemId: 6 })
  expect(lost.statsProcessed).toBe(true)
  expect(lost.guesses).toHaveLength(5)
  expect(() => act(lost)).toThrow("already complete")
})

it.each(["fresh", "in-progress", "loss", "win"])("keeps the established %s game when the guest has already won that day", state => {
  const guest = act(fresh())
  let existing = fresh(undefined, targetUid, "LEVEL_5")
  if (state === "in-progress") existing = act(existing, { type: "guess", itemId: 2 })
  if (state === "loss") existing = act(existing, { type: "giveUp" })
  if (state === "win") existing = act(existing)
  const targetStats = statsFor(existing)
  const before = structuredClone({ existing, targetStats, guest })
  const plan = merge([guest], [existing], targetStats)
  expect(plan).toMatchObject({ imported: 0, conflicts: 1 })
  expect(plan.stats).toEqual(targetStats)
  expect(plan.writes).toEqual([{ gameId: guest.id, archive: {
    id: `${sourceUid}_${guest.id}`,
    record: { policyVersion: 1, reason: "existing-profile-kept", sourceUid, game: { ...guest, playerID: targetUid } },
  } }])
  expect({ existing, targetStats, guest }).toEqual(before)
})

it("imports one immutable completion and credits it once despite replay after subsequent play", () => {
  const guest = act(fresh())
  const first = merge([guest])
  expect(first.writes[0].history).toEqual(gameHistory(guest))
  expect(first.stats).toMatchObject({ games: 1, allTimeScore: 550, wins: [1, 0, 0, 0, 0], winningDays: [guest.challengeId] })
  const replay = merge([guest], [first.writes[0].game!], first.stats)
  expect(replay).toEqual({ writes: [], stats: first.stats, imported: 0, conflicts: 0, alreadyImported: 1 })
  const unfinished = act(fresh("2026-10-14"), { type: "guess", itemId: 2 })
  const next = merge([unfinished], [], first.stats)
  const continued = act(next.writes[0].game!)
  const continuedStats = completeStats(next.stats, continued)
  expect(merge([unfinished], [continued], continuedStats)).toEqual({
    writes: [], stats: continuedStats, imported: 0, conflicts: 0, alreadyImported: 1,
  })
})

it("retains a loss and gives it no win or score credit", () => {
  const plan = merge([act(fresh(), { type: "giveUp" })])
  expect(plan.stats).toMatchObject({ games: 1, wins: [0, 0, 0, 0, 0], allTimeScore: 0, currentStreak: 0 })
  expect(plan.writes[0].history).toMatchObject({ gaveUp: true, wasCorrect: false, score: 0 })
})

it("counts Easy hint spending but does not turn Medium earned clues into currency spending", () => {
  const easy = act(fresh("2026-10-12"), { type: "hint", hintType: "director" })
  const medium = act(fresh("2026-10-13", sourceUid, "LEVEL_3"), { type: "guess", itemId: 2 })
  expect(Object.values(medium.hintsUsed).filter(Boolean)).toHaveLength(4)
  expect(merge([easy, medium]).stats.hintsUsedCount).toBe(1)
})

it("rebuilds calendar streaks across both profiles independent of page order", () => {
  const existing = act(fresh("2026-10-12", targetUid))
  const guestGames = [act(fresh("2026-10-11")), act(fresh("2026-10-13"))]
  const combined = merge(guestGames, [], statsFor(existing))
  expect(combined.stats).toMatchObject({ games: 3, currentStreak: 3, maxStreak: 3, lastCompletedDate: "2026-10-13", allTimeScore: 1650 })
  expect(merge([...guestGames].reverse(), [], statsFor(existing))).toEqual(combined)
  const firstPage = merge([guestGames[1]], [], statsFor(existing))
  const lastPage = merge([guestGames[0]], [], firstPage.stats)
  expect(lastPage.stats).toEqual(combined.stats)
})

it("does not replace an established loss with a guest win to extend a streak", () => {
  const existing = act(fresh("2026-10-12", targetUid), { type: "giveUp" })
  const guest = [act(fresh("2026-10-11")), act(fresh("2026-10-12")), act(fresh("2026-10-13"))]
  const plan = merge(guest, [existing], statsFor(existing))
  expect(plan.stats).toMatchObject({ games: 3, currentStreak: 1, maxStreak: 1, allTimeScore: 1100 })
  expect(plan.conflicts).toBe(1)
})

it("requires an explicit destination lookup for every source document", () => {
  expect(() => planAccountMergePage({ sourceUid, targetUid, sourceGames: [fresh()], destinationGames: new Map(), targetStats: initialStats(targetUid) })).toThrow("needs review")
})
it("rejects duplicate days and oversized pages without mutating target stats", () => {
  const stats = initialStats(targetUid)
  expect(() => merge([fresh(), fresh()], [], stats)).toThrow("needs review")
  expect(() => merge(Array.from({ length: MERGE_PAGE_SIZE + 1 }, (_, i) => fresh(`2026-10-${String(i + 1).padStart(2, "0")}`)), [], stats)).toThrow("needs review")
  expect(stats).toEqual(initialStats(targetUid))
})
it("rejects a changed source revision after its first import", () => {
  const game = fresh()
  const imported = merge([game]).writes[0].game!
  expect(() => merge([act(game)], [imported])).toThrow("needs review")
})
it.each([
  { schemaVersion: 1 }, { playerID: "another-user" }, { challengeId: "2026-02-31" },
  { id: "movies_2026-10-12" }, { guessesMax: 10 }, { revision: 1 }, { hintsUsed: { unknown: true } },
  { score: 1000 }, { statsProcessed: true }, { correctAnswer: true }, { startDate: "bad-date" },
  { guesses: [{ itemId: 2 }, { itemId: 2 }] }, { mergeOrigin: { guestUid: "old", revision: 0, policyVersion: 1 } },
])("rejects incompatible source records %j", patch => {
  expect(() => merge([{ ...fresh(), ...patch } as MergeGame])).toThrow("needs review")
})
it("rejects inconsistent destination ownership and statistics instead of zeroing them", () => {
  expect(() => merge([fresh()], [fresh()])).toThrow("needs review")
  expect(() => merge([fresh()], [], { ...initialStats(targetUid), id: sourceUid })).toThrow("needs review")
  expect(() => merge([fresh()], [], { ...initialStats(targetUid), games: -1 })).toThrow("needs review")
  expect(() => merge([fresh()], [], { ...initialStats(targetUid), wins: [1, 0, 0, 0, 0] })).toThrow("needs review")
})
it("rejects incomplete calendar statistics and malformed replay IDs", () => {
  const existing = act(fresh("2026-10-12", targetUid))
  expect(() => merge([fresh()], [], { ...statsFor(existing), winningDays: [] })).toThrow("needs review")
  expect(() => merge([fresh()], [], { ...statsFor(existing), lastCompletedDate: null })).toThrow("needs review")
  const guest = act(fresh())
  guest.actions[0].id = "bad/id"
  expect(() => merge([guest])).toThrow("needs review")
})
