import { createHash } from "node:crypto"
import { publishedContent } from "./publishedContent"

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
