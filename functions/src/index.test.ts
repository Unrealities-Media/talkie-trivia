// Callable contract tests. The transaction fixture is atomic/serialized, but is
// not a substitute for the Firestore emulator's retry and authorization tests.
const mockRecords = new Map<string, any>()
let mockQueue = Promise.resolve()
const mockRef = (path: string) => ({ path, get: async () => snapshot(path) })
function snapshot(path: string) {
  return { exists: mockRecords.has(path), data: () => structuredClone(mockRecords.get(path)) }
}
jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }))
jest.mock("firebase-admin/auth", () => ({ getAuth: jest.fn() }))
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    doc: mockRef,
    runTransaction: (fn: any) => {
      const run = mockQueue.then(async () => {
        const writes: (() => void)[] = []
        const result = await fn({
          get: async (ref: any) => {
            if (writes.length) throw new Error("Transaction reads must precede writes")
            return snapshot(ref.path)
          },
          create: (ref: any, data: any) => {
            if (mockRecords.has(ref.path)) throw new Error("Document already exists")
            writes.push(() => mockRecords.set(ref.path, structuredClone(data)))
          },
          set: (ref: any, data: any) => writes.push(() => mockRecords.set(ref.path, structuredClone(data))),
        })
        writes.forEach(write => write())
        return result
      })
      mockQueue = run.catch(() => undefined)
      return run
    },
  }),
}))
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (_options: any, handler: any) => handler,
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))
jest.mock("./catalog", () => ({
  catalogVersion: "a".repeat(64),
  catalog: new Map([
    [1, { i: 1, t: "Answer", y: "1999", p: "/a.jpg", d: "Director A", c: ["Actor A"], g: ["Drama"] }],
    [2, { i: 2, t: "Other", y: "2001", p: "/b.jpg", d: "Director B", c: ["Actor B"], g: ["Comedy"] }],
  ]),
}))
import { startGame, applyGameAction, submitGameResult, beginAccountMerge } from "./index"
it("keeps merge creation disabled outside the isolated emulator rollout", async () => {
  const previous = process.env.FUNCTIONS_EMULATOR
  delete process.env.FUNCTIONS_EMULATOR
  try { await expect(Promise.resolve().then(() => (beginAccountMerge as any)({ data: {} }))).rejects.toMatchObject({ code: "failed-precondition" }) }
  finally { if (previous !== undefined) process.env.FUNCTIONS_EMULATOR = previous }
})
import { createHash } from "node:crypto"
import { CLUE_LEVELS, contentDigest } from "./publishedContent"
const start = (data: any = { difficulty: "LEVEL_3", catalogVersion: "a".repeat(64) }, uid = "user-with-hyphens") => (startGame as any)({ auth: { uid }, data })
const act = (data: any = {}, uid = "user-with-hyphens") => (applyGameAction as any)({ auth: { uid }, data: { challengeId: "2026-10-13_LEVEL_3", expectedRevision: 0, actionId: "command-00000001", type: "guess", itemId: 1, ...data } })
const statsPath = "players/user-with-hyphens/privateStats/summary"
describe("authoritative game callables", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-13T12:00:00Z"))
    mockRecords.clear()
    const description = "A sufficiently detailed, reviewed clue for the daily movie challenge that players can read without learning its title."
    mockRecords.set("dailyGames/2026-10-13_LEVEL_3", { movieId: 1, difficulty: "LEVEL_3", schemaVersion: 1, catalogVersion: "a".repeat(64), date: new Date("2026-10-13T00:00:00Z"),
      content: { description, imdbId: "", tagline: "" }, contentHash: createHash("sha256").update(`1\n${description}\n\n`).digest("hex"), reviewedBy: "editor", reviewedAt: "2026-10-12T00:00:00Z" })
    mockRecords.set("movies/1", { overview: "A sufficiently detailed clue for the daily movie challenge that players can read." })
    for (const difficulty of CLUE_LEVELS) {
      mockRecords.set('dailyGames/2026-10-13_' + difficulty, { ...mockRecords.get('dailyGames/2026-10-13_LEVEL_3'), difficulty })
    }
    mockQueue = Promise.resolve()
  })
  afterEach(() => jest.useRealTimers())
  it("shares the valid-request budget across routes, rejects invalid requests cheaply, and isolates accounts", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(start({})).rejects.toMatchObject({ code: "invalid-argument" })
      await expect(act({ type: "invalid" })).rejects.toMatchObject({ code: "invalid-argument" })
      await expect((submitGameResult as any)({ auth: { uid: "user-with-hyphens" }, data: {} })).rejects.toMatchObject({ code: "invalid-argument" })
    }
    expect(mockRecords.has(statsPath)).toBe(false)
    expect(mockRecords.has("players/user-with-hyphens/privateRateLimits/gameplay")).toBe(false)
    for (let i = 0; i < 10; i++) {
      await start()
      await act()
      await (submitGameResult as any)({ auth: { uid: "user-with-hyphens" }, data: { challengeId: "2026-10-13_LEVEL_3" } })
    }
    await expect(start()).rejects.toMatchObject({ code: "resource-exhausted" })
    await expect(start(undefined, "another-user")).resolves.toHaveProperty("game")
    jest.advanceTimersByTime(1999)
    await expect(start()).rejects.toMatchObject({ code: "resource-exhausted" })
    jest.advanceTimersByTime(1)
    await expect(start()).resolves.toHaveProperty("game")
    await expect(start()).rejects.toMatchObject({ code: "resource-exhausted" })
  })
  it("caps refill after inactivity and does not refill when the clock moves backward", async () => {
    const path = "players/user-with-hyphens/privateRateLimits/gameplay"
    mockRecords.set(path, { tokens: 0, updatedAt: Date.now() + 1000 })
    await expect(start()).rejects.toMatchObject({ code: "resource-exhausted" })
    jest.advanceTimersByTime(301000)
    await start()
    expect(mockRecords.get(path).tokens).toBe(29)
  })
  it("does not create quota metadata for a deleted account or reset corrupt counters", async () => {
    const path = "players/user-with-hyphens/privateRateLimits/gameplay"
    mockRecords.set("accountDeletions/user-with-hyphens", { status: "complete" })
    await expect(start()).rejects.toMatchObject({ code: "permission-denied" })
    expect(mockRecords.has(path)).toBe(false)
    mockRecords.delete("accountDeletions/user-with-hyphens")
    mockRecords.set(path, { tokens: "30", updatedAt: Date.now() })
    await expect(start()).rejects.toMatchObject({ code: "internal" })
    expect(mockRecords.get(path).tokens).toBe("30")
  })
  it("selects each difficulty's published clue and preserves it when resuming", async () => {
    const snapshot = mockRecords.get("dailyGames/2026-10-13_LEVEL_3")
    const clues = Object.fromEntries(CLUE_LEVELS.map(level => [level, level === "LEVEL_1" ? snapshot.content.description : `A distinct clue for ${level} about a difficult return.`])) as Record<typeof CLUE_LEVELS[number], string>
    const content = { ...snapshot.content, clues }
    mockRecords.set("dailyGames/2026-10-13_LEVEL_3", { ...snapshot, schemaVersion: 2, content, contentHash: contentDigest(1, content) })
    for (const difficulty of CLUE_LEVELS) {
      mockRecords.set('dailyGames/2026-10-13_' + difficulty, { ...snapshot, difficulty, schemaVersion: 2, content, contentHash: contentDigest(1, content) })
      const uid = 'player-' + difficulty
      const result = await start({ difficulty, catalogVersion: "a".repeat(64) }, uid)
      expect(result.game.triviaItem.description).toBe(clues[difficulty])
      expect(result.game.triviaItem.metadata.fullSummary).toBe(content.description)
      expect(result.game.triviaItem.clues).toBeUndefined()
      const resumed = await start({ difficulty, catalogVersion: "a".repeat(64) }, uid)
      expect(resumed.game.difficulty).toBe(difficulty)
      expect(resumed.game.triviaItem.description).toBe(clues[difficulty])
      expect(resumed.game.triviaItem.metadata.fullSummary).toBe(content.description)
    }
  })
  it("requires authentication and rejects client identities, dates and result payloads", async () => {
    await expect((startGame as any)({ data: {} })).rejects.toMatchObject({ code: "unauthenticated" })
    for (const uid of [undefined, "", "nested/path", "x".repeat(129), 12]) {
      await expect((startGame as any)({ auth: { uid }, data: {} })).rejects.toMatchObject({ code: "unauthenticated" })
    }
    await expect(start({ difficulty: "LEVEL_3", catalogVersion: "a".repeat(64), playerID: "victim" })).rejects.toMatchObject({ code: "invalid-argument" })
    await expect((submitGameResult as any)({ auth: { uid: "attacker" }, data: { playerGame: { id: "victim-2026-10-13", correctAnswer: true } } })).rejects.toMatchObject({ code: "invalid-argument" })
  })
  it("starts once with immutable server difficulty and an authoritative date", async () => {
    const first = await start()
    const again = await start({ difficulty: "LEVEL_3", catalogVersion: "a".repeat(64) })
    expect(first.game.challengeId).toBe("2026-10-13_LEVEL_3")
    expect(first.serverNow).toBe("2026-10-13T12:00:00.000Z")
    expect(first.resetAt).toBe("2026-10-14T00:00:00.000Z")
    expect(again.game.difficulty).toBe("LEVEL_3")
    expect(again.game.guessesMax).toBe(5)
    expect(mockRecords.get(statsPath).games).toBe(0)
  })
  it("rejects unknown catalogs and missing content without creating partial state", async () => {
    await expect(start({ difficulty: "LEVEL_3", catalogVersion: "b".repeat(64) })).rejects.toMatchObject({ code: "failed-precondition" })
    mockRecords.delete("dailyGames/2026-10-13_LEVEL_3")
    await expect(start()).rejects.toMatchObject({ code: "unavailable" })
    expect(mockRecords.has(statsPath)).toBe(false)
  })
  it("cannot address another user's game or inject a win", async () => {
    await start()
    await expect(act({ playerID: "user-with-hyphens" }, "attacker")).rejects.toMatchObject({ code: "invalid-argument" })
    await expect(act({}, "attacker")).rejects.toMatchObject({ code: "not-found" })
    await expect(act({ correctAnswer: true, itemId: 2 })).rejects.toMatchObject({ code: "invalid-argument" })
    const result = await act({ itemId: 2 })
    expect(result.game.correctAnswer).toBe(false)
    expect(result.game.score).toBe(0)
    expect(result.game.hintsUsed).toEqual({})
    expect(result.stats.games).toBe(0)
  })
  it("blocks all game endpoints once account deletion is requested", async () => {
    await start()
    mockRecords.set("accountDeletions/user-with-hyphens", { status: "pending" })
    await expect(start()).rejects.toMatchObject({ code: "permission-denied" })
    await expect(act()).rejects.toMatchObject({ code: "permission-denied" })
    await expect((submitGameResult as any)({ auth: { uid: "user-with-hyphens" }, data: { challengeId: "2026-10-13_LEVEL_3" } })).rejects.toMatchObject({ code: "permission-denied" })
    expect(mockRecords.get(statsPath).games).toBe(0)
  })
  it("blocks all game endpoints while either role in an account merge is reserved", async () => {
    await start()
    for (const role of ["source", "target"]) {
      mockRecords.set("accountMergeLocks/user-with-hyphens", { jobId: "guest", role })
      await expect(start()).rejects.toMatchObject({ code: "failed-precondition" })
      await expect(act()).rejects.toMatchObject({ code: "failed-precondition" })
      await expect((submitGameResult as any)({ auth: { uid: "user-with-hyphens" }, data: { challengeId: "2026-10-13_LEVEL_3" } })).rejects.toMatchObject({ code: "failed-precondition" })
      expect(mockRecords.get(statsPath).games).toBe(0)
    }
  })
  it("uses the immutable schedule clue for every player even if upstream movies change", async () => {
    const first = await start()
    mockRecords.set("movies/1", { manual_overview: "An unreviewed edit", overview: "Different source text" })
    const second = await start(undefined, "another-player")
    expect(second.game.triviaItem.description).toBe(first.game.triviaItem.description)
  })
  it("rejects unreviewed legacy schedules and tampered clues without creating a game", async () => {
    const ref = "dailyGames/2026-10-13_LEVEL_3"
    const snapshot = mockRecords.get(ref)
    mockRecords.set(ref, { movieId: 1 })
    await expect(start()).rejects.toMatchObject({ code: "unavailable" })
    mockRecords.set(ref, { ...snapshot, content: { ...snapshot.content, description: "A changed clue. ".repeat(10) } })
    await expect(start()).rejects.toMatchObject({ code: "unavailable" })
    expect(mockRecords.has(statsPath)).toBe(false)
  })
  it("persists a nonterminal guess and resumes it", async () => {
    await start()
    await act({ itemId: 2 })
    expect((await start()).game.guesses).toEqual([{ itemId: 2 }])
  })
  it("awards exactly one result under concurrent retries and a lost-response replay", async () => {
    await start()
    const results = await Promise.all(Array.from({ length: 10 }, () => act()))
    expect(results.every(result => result.game.score === 700)).toBe(true)
    expect(mockRecords.get(statsPath)).toMatchObject({ games: 1, allTimeScore: 700, currentStreak: 1, wins: [1, 0, 0, 0, 0] })
    expect([...mockRecords.keys()].filter(path => path.includes("gameHistoryV2"))).toHaveLength(1)
    jest.setSystemTime(new Date("2026-10-20T12:00:00Z"))
    expect((await act()).stats.games).toBe(1)
  })
  it("rejects action ID reuse with changed input, stale revisions and post-completion changes", async () => {
    await start()
    await act({ itemId: 2 })
    await expect(act()).rejects.toMatchObject({ code: "already-exists" })
    await expect(act({ actionId: "command-00000002" })).rejects.toMatchObject({ code: "aborted" })
    await act({ actionId: "command-00000002", expectedRevision: 1 })
    await expect(act({ actionId: "command-00000003", expectedRevision: 2 })).rejects.toMatchObject({ code: "failed-precondition" })
  })
  it("limits hints per Easy game and counts each spend once", async () => {
    await start({ difficulty: "LEVEL_2", catalogVersion: "a".repeat(64) })
    for (const [i, hintType] of ["actors", "director", "genre"].entries()) {
      const command = { challengeId: "2026-10-13_LEVEL_2", type: "hint", itemId: undefined, hintType, expectedRevision: i, actionId: `hint-command-000${i}` }
      await act(command)
      await act(command)
    }
    expect(mockRecords.get(statsPath).hintsUsedCount).toBe(3)
    await expect(act({ challengeId: "2026-10-13_LEVEL_2", type: "hint", itemId: undefined, hintType: "decade", expectedRevision: 3, actionId: "hint-command-0004" })).rejects.toMatchObject({ code: "failed-precondition" })
    const win = await act({ challengeId: "2026-10-13_LEVEL_2", expectedRevision: 3, actionId: "guess-command-win" })
    expect(win.game.score).toBe(400)
  })
  it("counts a give-up once and returns the saved result without mutating it", async () => {
    await start()
    const result = await act({ type: "giveUp", itemId: undefined })
    expect(result.stats).toMatchObject({ games: 1, allTimeScore: 0, currentStreak: 1 })
    const fetched = await (submitGameResult as any)({ auth: { uid: "user-with-hyphens" }, data: { challengeId: "2026-10-13_LEVEL_3" } })
    expect(fetched.game).toEqual(result.game)
    expect(fetched.stats.games).toBe(1)
  })
})
