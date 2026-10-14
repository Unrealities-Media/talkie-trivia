import AsyncStorage from "@react-native-async-storage/async-storage"
import { gameService } from "../../src/services/gameService"
import { auth } from "../../src/services/firebaseClient"
import { getDoc, getDocs, startAfter, limit, orderBy } from "firebase/firestore"
import { defaultPlayerGame, defaultPlayerStats } from "../../src/models/default"
import { deletionStorage } from "../../src/services/deletionStorage"
const mockCall = jest.fn()
jest.mock("firebase/functions", () => ({ getFunctions: () => ({}), httpsCallable: (_: unknown, name: string) => (data: unknown) => mockCall(name, data) }))
jest.mock("../../src/services/firebaseClient", () => ({ db: {}, app: {}, auth: { currentUser: { uid: "p1" } } }))
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn() } }))
const game = { ...defaultPlayerGame, id: "movies_2026-10-13", playerID: "p1", challengeId: "2026-10-13", revision: 0 }
const result = { game, stats: { ...defaultPlayerStats, id: "p1" }, challengeId: "2026-10-13", resetAt: "2026-10-14T00:00:00Z", serverNow: "2026-10-13T23:00:00Z" }
describe("durable game commands", () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    ;(deletionStorage.read as jest.Mock).mockResolvedValue(null)
    await AsyncStorage.clear()
    ;(auth as any).currentUser = { uid: "p1" }
    mockCall.mockResolvedValue({ data: result })
  })
  it("stores the command before sending and removes it only after acknowledgment", async () => {
    mockCall.mockImplementation(async (_name, command) => {
      expect(JSON.parse((await AsyncStorage.getItem("game-action-v2:p1"))!)).toEqual(command)
      expect(command).toMatchObject({ type: "guess", itemId: 1, expectedRevision: 0, challengeId: "2026-10-13" })
      expect(command).not.toHaveProperty("correctAnswer")
      return { data: result }
    })
    await gameService.applyAction(game, { type: "guess", itemId: 1 })
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
  })
  it("keeps unsent moves intact and blocks new commands while merge recovery is pending", async () => {
    await AsyncStorage.setItem("account-merge-v1", JSON.stringify({ sourceUid: "p1", targetUid: "saved", operationId: "confirmation-00001", status: "pending" }))
    await expect(gameService.applyAction(game, { type: "giveUp" })).rejects.toThrow("account recovery")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
    await AsyncStorage.setItem("game-action-v2:p1", JSON.stringify({ type: "giveUp", actionId: "old" }))
    await expect(gameService.resumePendingAction("p1")).rejects.toThrow("account recovery")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).not.toBeNull()
    expect(mockCall).not.toHaveBeenCalled()
  })
  it("blocks new moves and pending replay once a deletion receipt exists", async () => {
    ;(deletionStorage.read as jest.Mock).mockResolvedValue({ uid: "p1", status: "submitting" })
    await expect(gameService.applyAction(game, { type: "giveUp" })).rejects.toThrow("deletion is in progress")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
    await AsyncStorage.setItem("game-action-v2:p1", JSON.stringify({ type: "giveUp", actionId: "old" }))
    await expect(gameService.resumePendingAction("p1")).rejects.toThrow("deletion is in progress")
    expect(mockCall).not.toHaveBeenCalled()
    await gameService.clearLocalProgress("p1")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
  })
  it("replays the identical action after a lost response, including on startup", async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error("Response lost"), { code: "functions/unavailable" }))
    await expect(gameService.applyAction(game, { type: "guess", itemId: 1 })).rejects.toThrow("Response lost")
    const original = mockCall.mock.calls[0][1]
    await gameService.startGame("p1", "LEVEL_3")
    expect(mockCall.mock.calls[1]).toEqual(["applyGameAction", original])
    expect(mockCall.mock.calls[2][0]).toBe("startGame")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
  })
  it("does not send a new command over an unacknowledged move", async () => {
    mockCall.mockRejectedValueOnce(new Error("offline"))
    await gameService.applyAction(game, { type: "guess", itemId: 1 }).catch(() => undefined)
    await expect(gameService.applyAction(game, { type: "giveUp" })).rejects.toThrow("pending move")
    expect(mockCall).toHaveBeenCalledTimes(1)
  })
  it("discards definitively rejected stale revisions so refresh can recover", async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error("Refresh"), { code: "functions/aborted" }))
    await expect(gameService.applyAction(game, { type: "guess", itemId: 1 })).rejects.toThrow("Refresh")
    expect(await AsyncStorage.getItem("game-action-v2:p1")).toBeNull()
    await gameService.startGame("p1", "LEVEL_3")
    expect(mockCall).toHaveBeenCalledTimes(2)
  })
  it("never sends a pending move under another account", async () => {
    mockCall.mockRejectedValueOnce(new Error("offline"))
    await gameService.applyAction(game, { type: "guess", itemId: 1 }).catch(() => undefined)
    ;(auth as any).currentUser = { uid: "p2" }
    await expect(gameService.resumePendingAction("p1")).rejects.toThrow("account changed")
    expect(mockCall).toHaveBeenCalledTimes(1)
    expect(await AsyncStorage.getItem("game-action-v2:p1")).not.toBeNull()
  })
  it("does not send a move if durable storage fails", async () => {
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("storage full"))
    await expect(gameService.applyAction(game, { type: "guess", itemId: 1 })).rejects.toThrow("storage full")
    expect(mockCall).not.toHaveBeenCalled()
  })
  it("anchors a valid UTC reset to monotonic receipt time, not the device date", async () => {
    const clock = jest.spyOn(performance, "now").mockReturnValue(500)
    const saved = await gameService.startGame("p1", "LEVEL_3")
    expect(saved.receivedAtMonotonic).toBe(500)
    expect(Date.parse(saved.resetAt) - Date.parse(saved.serverNow)).toBe(3600000)
    clock.mockRestore()
  })
  it.each([{ serverNow: "bad" }, { resetAt: "2026-10-14T05:00:00Z" }])("rejects invalid server timing %j", async override => {
    mockCall.mockResolvedValue({ data: { ...result, ...override } })
    await expect(gameService.startGame("p1", "LEVEL_3")).rejects.toThrow("could not be read")
  })
  it("reads saved account statistics without starting today's game", async () => {
    ;(getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => result.stats })
    expect(await gameService.fetchPlayerStats("p1")).toEqual(result.stats)
    expect(mockCall).not.toHaveBeenCalled()
  })
  it("rejects a statistics response after the active account changes", async () => {
    let finish!: (value: unknown) => void
    ;(getDoc as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const read = gameService.fetchPlayerStats("p1")
    ;(auth as any).currentUser = { uid: "p2" }
    finish({ exists: () => true, data: () => result.stats })
    await expect(read).rejects.toThrow("account changed")
  })
  it("pages history with a stable cursor, bounded lookahead and no empty trailing page", async () => {
    const docs = Array.from({ length: 21 }, (_, i) => ({ id: `result-${i}`, data: () => ({ dateId: "2026-10-13", itemTitle: `Movie ${i}` }) }))
    ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs }).mockResolvedValueOnce({ docs: docs.slice(20) })
    const first = await gameService.fetchGameHistory("p1")
    expect(first.entries).toHaveLength(20)
    expect(first.next).toEqual({ uid: "p1", dateId: "2026-10-13", id: "result-19" })
    const last = await gameService.fetchGameHistory("p1", first.next)
    expect(last.entries).toEqual([docs[20].data()])
    expect(last.next).toBeNull()
    expect(limit).toHaveBeenCalledWith(21)
    expect(orderBy).toHaveBeenCalledWith("__name__", "desc")
    expect(startAfter).toHaveBeenCalledWith("2026-10-13", "result-19")
  })
  it.each([0, 20])("ends history pagination at exactly %i records", async count => {
    ;(getDocs as jest.Mock).mockResolvedValueOnce({ docs: Array.from({ length: count }, () => ({ data: () => ({ dateId: "2026-10-13" }) })) })
    expect((await gameService.fetchGameHistory("p1")).next).toBeNull()
  })
  it.each([
    { uid: "other", dateId: "2026-10-13", id: "record" },
    { uid: "p1", dateId: "2026-02-30", id: "record" },
    { uid: "p1", dateId: "2026-10-13", id: "path/record" },
  ])("rejects a different account or malformed history cursor (%#)", async cursor => {
    await expect(gameService.fetchGameHistory("p1", cursor)).rejects.toThrow("Refresh")
    expect(getDocs).not.toHaveBeenCalled()
  })
  it("rejects history reads before and after an account switch", async () => {
    await expect(gameService.fetchGameHistory("other")).rejects.toThrow("account changed")
    expect(getDocs).not.toHaveBeenCalled()
    ;(getDocs as jest.Mock).mockImplementationOnce(async () => {
      ;(auth as any).currentUser = { uid: "other" }
      return { docs: [] }
    })
    await expect(gameService.fetchGameHistory("p1")).rejects.toThrow("account changed")
  })
})
