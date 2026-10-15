import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { publishedContent, contentDigest, CLUE_LEVELS } from "./publishedContent"

// Domain validation test; Firebase transport/runtime is exercised separately.
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class extends Error { constructor(public code: string, message: string) { super(message) } },
}))

const challenge = "2026-10-13"
const version = "a".repeat(64)
function fixture() {
  const content = { description: "A fictional traveler explores a distant city, finding clues to a mystery that brings several strangers together before a difficult decision.", imdbId: "tt1234567", tagline: "" }
  return { schemaVersion: 1, movieId: 1, catalogVersion: version, date: new Date(`${challenge}T00:00:00Z`),
    content, reviewedBy: "test-editor", reviewedAt: "2026-10-12T00:00:00Z",
    contentHash: createHash("sha256").update(`1\n${content.description}\n${content.imdbId}\n`).digest("hex") }
}
describe("published content contract", () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date("2026-10-13T12:00:00Z")))
  afterEach(() => jest.useRealTimers())
  it("agrees with the publication digests for all forty beta sets", () => {
    const entries = JSON.parse(readFileSync(join(__dirname, "../../content/beta-movies.json"), "utf8"))
    expect(entries).toHaveLength(40)
    for (const item of entries) {
      const content = { description: item.description, imdbId: item.imdbId, tagline: item.tagline, clues: item.clues }
      expect(contentDigest(item.movieId, content)).toBe(item.contentHash)
      expect(publishedContent({ ...item, schemaVersion: 2, content, date: new Date(`${challenge}T00:00:00Z`), reviewedBy: "test-only", reviewedAt: "2026-10-12T00:00:00Z" }, challenge, item.catalogVersion).clues).toEqual(item.clues)
    }
  })
  it("validates every variant, including short clues, and binds all variants to the digest", () => {
    const value = fixture()
    const clues = Object.fromEntries(CLUE_LEVELS.map(level => [level, value.content.description])) as Record<typeof CLUE_LEVELS[number], string>
    clues.LEVEL_5 = "Two rivals need one another to return."
    const content = { ...value.content, clues }
    const snapshot = { ...value, schemaVersion: 2, content, contentHash: contentDigest(1, content) }
    expect(publishedContent(snapshot, challenge, version).clues?.LEVEL_5).toBe(clues.LEVEL_5)
    for (const level of CLUE_LEVELS) {
      const changed = { ...content, clues: { ...clues, [level]: "A different and sufficiently lengthy clue." } }
      expect(() => publishedContent({ ...snapshot, content: changed }, challenge, version)).toThrow()
      const missing = { ...clues } as Partial<typeof clues>
      delete missing[level]
      expect(() => publishedContent({ ...snapshot, content: { ...content, clues: missing } }, challenge, version)).toThrow()
    }
    expect(() => publishedContent({ ...snapshot, schemaVersion: 1 }, challenge, version)).toThrow()
  })
  it("accepts the Firestore timestamp shape and the reviewed content", () => {
    const value = fixture()
    expect(publishedContent({ ...value, date: { toDate: () => value.date } }, challenge, version)).toEqual(value.content)
  })
  it.each([
    { date: null }, { date: { toDate: "invalid" } }, { date: new Date("2026-10-14T00:00:00Z") },
    { schemaVersion: 0 }, { catalogVersion: "other" }, { reviewedAt: "2099-01-01T00:00:00Z" },
    { reviewedBy: " " }, { movieId: -1 }, { contentHash: "changed" }, { content: { description: "short" } },
  ])("rejects invalid snapshots without reading mutable source records: %p", patch => {
    expect(() => publishedContent({ ...fixture(), ...patch }, challenge, version)).toThrow("being prepared")
  })
})
