import { guestArchiveService } from "../../src/services/guestArchiveService"
import { auth } from "../../src/services/firebaseClient"
import { deletionStorage } from "../../src/services/deletionStorage"
import { mergeStorage } from "../../src/services/mergeStorage"
import { getDocs, startAfter, limit } from "firebase/firestore"

jest.mock("../../src/services/firebaseClient", () => ({ auth: { currentUser: null }, db: {} }))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn() } }))
jest.mock("../../src/services/mergeStorage", () => ({ mergeStorage: { read: jest.fn() } }))
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => args), documentId: () => "__name__", getDocs: jest.fn(),
  limit: jest.fn(value => ({ limit: value })), orderBy: jest.fn((...args) => ({ orderBy: args })),
  query: jest.fn((...args) => args), startAfter: jest.fn((...args) => ({ startAfter: args })),
}))
const record = (index = 0) => {
  const sourceUid = `guest-${index}`
  const game = { schemaVersion: 2, scoringVersion: 1, gameMode: "movies", playerID: "saved", id: "movies_2026-10-13", challengeId: "2026-10-13",
    difficulty: "LEVEL_2", guessesMax: 5, guesses: [{ itemId: 1 }], correctAnswer: true, gaveUp: false, statsProcessed: true,
    score: 500, hintsUsed: {}, answerId: 1, triviaItem: { id: 1, title: "Original answer", description: "Original clue", hints: [] },
    startDate: "2026-10-13T12:00:00.000Z", endDate: "2026-10-13T13:00:00.000Z" }
  const data = { policyVersion: 1, reason: "existing-profile-kept", sourceUid, game }
  return { id: `${sourceUid}_${game.id}`, data: () => data }
}
beforeEach(() => {
  jest.clearAllMocks()
  ;(auth as any).currentUser = { uid: "saved" }
  ;(deletionStorage.read as jest.Mock).mockResolvedValue(null)
  ;(mergeStorage.read as jest.Mock).mockResolvedValue(null)
  ;(getDocs as jest.Mock).mockResolvedValue({ docs: [record()] })
})
it("decodes the immutable snapshot and uses a bounded date/document cursor with lookahead", async () => {
  const docs = Array.from({ length: 21 }, (_, index) => record(index))
  ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs })
  const first = await guestArchiveService.page("saved")
  expect(first.entries).toHaveLength(20)
  expect(first.entries[0].game).toMatchObject({ startDate: new Date("2026-10-13T12:00:00Z"), triviaItem: { title: "Original answer" } })
  expect(first.next).toEqual({ uid: "saved", dateId: "2026-10-13", id: docs[19].id })
  await guestArchiveService.page("saved", first.next)
  expect(limit).toHaveBeenCalledWith(21)
  expect(startAfter).toHaveBeenCalledWith("2026-10-13", docs[19].id)
})
it.each([0, 1, 20])("does not offer an empty next page for %i records", async count => {
  ;(getDocs as jest.Mock).mockResolvedValue({ docs: Array.from({ length: count }, (_, index) => record(index)) })
  const result = await guestArchiveService.page("saved")
  expect(result.entries).toHaveLength(count)
  expect(result.next).toBeNull()
})
it.each([
  (data: any) => { data.game.playerID = "other" },
  (data: any) => { data.sourceUid = "other" },
  (data: any) => { data.game.challengeId = "2026-02-30" },
  (data: any) => { data.game.difficulty = "unknown" },
  (data: any) => { data.game.triviaItem.id = 2 },
  (data: any) => { data.game.guesses[0].hintInfo = [{}] },
  (data: any) => { data.game.startDate = "bad-date" },
])("fails the whole page on an unreadable lookahead instead of silently skipping it (%#)", async corrupt => {
  const docs = Array.from({ length: 21 }, (_, index) => record(index))
  corrupt(docs[20].data())
  ;(getDocs as jest.Mock).mockResolvedValue({ docs })
  await expect(guestArchiveService.page("saved")).rejects.toThrow("no record was skipped")
})
it.each([
  { uid: "other", dateId: "2026-10-13", id: "record" },
  { uid: "saved", dateId: "2026-02-30", id: "record" },
  { uid: "saved", dateId: "2026-10-13", id: "path/record" },
])("rejects a malformed or different account's cursor before reading (%#)", async cursor => {
  await expect(guestArchiveService.page("saved", cursor)).rejects.toThrow("Reopen")
  expect(getDocs).not.toHaveBeenCalled()
})
it("discards a completed read after an account change", async () => {
  ;(getDocs as jest.Mock).mockImplementationOnce(async () => {
    ;(auth as any).currentUser = { uid: "other" }
    return { docs: [record()] }
  })
  await expect(guestArchiveService.page("saved")).rejects.toThrow("account changed")
})
it.each([deletionStorage, mergeStorage])("blocks reads before and after a recovery barrier appears (%#)", async storage => {
  ;(storage.read as jest.Mock).mockResolvedValueOnce({ status: "pending" })
  await expect(guestArchiveService.page("saved")).rejects.toThrow("Finish account recovery")
  expect(getDocs).not.toHaveBeenCalled()
  ;(getDocs as jest.Mock).mockImplementationOnce(async () => {
    ;(storage.read as jest.Mock).mockResolvedValueOnce({ status: "pending" })
    return { docs: [record()] }
  })
  await expect(guestArchiveService.page("saved")).rejects.toThrow("Finish account recovery")
})
it("propagates storage and network failures without treating them as an empty archive", async () => {
  ;(mergeStorage.read as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"))
  await expect(guestArchiveService.page("saved")).rejects.toThrow("storage unavailable")
  expect(getDocs).not.toHaveBeenCalled()
  ;(getDocs as jest.Mock).mockRejectedValueOnce(new Error("offline"))
  await expect(guestArchiveService.page("saved")).rejects.toThrow("offline")
})
