import { accountDeletionService } from "../../src/services/accountDeletionService"
import { deletionStorage, DeletionReceipt } from "../../src/services/deletionStorage"
import { auth } from "../../src/services/firebaseClient"
import { signOut } from "firebase/auth"
import { gameService } from "../../src/services/gameService"
import { sessionStorage } from "../../src/services/sessionStorage"
import { reminderService } from "../../src/services/reminderService"

const mockCall = jest.fn()
jest.mock("firebase/functions", () => ({ getFunctions: () => ({}), httpsCallable: (_: unknown, name: string) => (data: unknown) => mockCall(name, data) }))
jest.mock("firebase/auth", () => ({ signOut: jest.fn() }))
jest.mock("../../src/services/firebaseClient", () => ({ app: { options: { projectId: "demo-talkie-trivia" } }, auth: { currentUser: { uid: "p1" } } }))
jest.mock("../../src/services/gameService", () => ({ gameService: { clearLocalProgress: jest.fn() } }))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }))
jest.mock("../../src/services/sessionStorage", () => ({ sessionStorage: { clearFor: jest.fn() } }))
jest.mock("expo-notifications", () => ({ cancelAllScheduledNotificationsAsync: jest.fn(), dismissAllNotificationsAsync: jest.fn() }))
jest.mock("../../src/services/reminderService", () => ({ reminderService: { disable: jest.fn() } }))

const initial: DeletionReceipt = { uid: "p1", secret: "a".repeat(64), status: "prepared" }
let stored: DeletionReceipt | null
const originalFetch = global.fetch
beforeEach(() => {
  jest.resetAllMocks()
  stored = null
  ;(auth as any).currentUser = { uid: "p1" }
  ;(deletionStorage.read as jest.Mock).mockImplementation(async () => stored)
  ;(deletionStorage.write as jest.Mock).mockImplementation(async value => { stored = value })
  mockCall.mockResolvedValue({ data: { secret: initial.secret } })
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { status: "complete" } }) })
})
afterEach(() => { global.fetch = originalFetch })

it("durably stores a prepared receipt before the irreversible request and rejects storage failure", async () => {
  await expect(accountDeletionService.prepare("p1")).resolves.toEqual(initial)
  mockCall.mockImplementation(async name => {
    expect(name).toBe("deleteAccount")
    expect(stored?.status).toBe("submitting")
    return { data: { accepted: true, complete: true } }
  })
  await expect(accountDeletionService.submit(initial)).resolves.toMatchObject({ status: "complete" })
  ;(deletionStorage.write as jest.Mock).mockRejectedValueOnce(new Error("disk full"))
  mockCall.mockClear()
  await expect(accountDeletionService.submit(initial)).rejects.toThrow("disk full")
  expect(mockCall).not.toHaveBeenCalled()
})

it("recovers a lost deletion response after Auth is gone using a status-only receipt", async () => {
  stored = initial
  mockCall.mockRejectedValueOnce(new Error("response lost"))
  await expect(accountDeletionService.submit(initial)).rejects.toThrow("response lost")
  expect(stored?.status).toBe("submitting")
  ;(auth as any).currentUser = null
  await expect(accountDeletionService.refresh(stored!)).resolves.toMatchObject({ status: "complete" })
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("getAccountDeletionStatus"), expect.objectContaining({
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { uid: "p1", secret: initial.secret } }),
  }))
  expect(stored?.status).toBe("complete")
})

it("never turns missing receipts or network failures into confirmed completion", async () => {
  stored = { ...initial, status: "submitting" }
  ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("offline"))
  await expect(accountDeletionService.refresh(stored)).rejects.toThrow("offline")
  expect(stored.status).toBe("submitting")
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ result: { status: "unknown" } }) })
  await expect(accountDeletionService.refresh(stored)).resolves.toMatchObject({ status: "unknown" })
})

it("keeps the receipt if local cleanup fails and never signs out a different account", async () => {
  stored = { ...initial, status: "complete" }
  ;(gameService.clearLocalProgress as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"))
  await expect(accountDeletionService.clearLocal(stored)).rejects.toThrow("storage unavailable")
  expect(signOut).not.toHaveBeenCalled()
  expect(deletionStorage.clear).not.toHaveBeenCalled()
  ;(auth as any).currentUser = { uid: "other" }
  await accountDeletionService.clearLocal(stored)
  expect(gameService.clearLocalProgress).toHaveBeenLastCalledWith("p1")
  expect(sessionStorage.clearFor).toHaveBeenCalledWith("p1")
  expect(reminderService.disable).toHaveBeenCalled()
  expect(signOut).not.toHaveBeenCalled()
})

it("reports incomplete local cleanup when the account marker cannot be removed", async () => {
  ;(sessionStorage.clearFor as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"))
  await expect(accountDeletionService.clearLocal({ ...initial, status: "complete" })).rejects.toThrow("storage unavailable")
  expect(signOut).not.toHaveBeenCalled()
  expect(deletionStorage.clear).not.toHaveBeenCalled()
})

it("preserves acknowledged completion after the server receipt expires", async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ result: { status: "unknown" } }) })
  await expect(accountDeletionService.refresh({ ...initial, status: "complete" })).resolves.toMatchObject({ status: "complete" })
})

it("does not claim local deletion cleanup when reminder cancellation fails", async () => {
  ;(reminderService.disable as jest.Mock).mockRejectedValueOnce(new Error("reminder cancellation unavailable"))
  await expect(accountDeletionService.clearLocal({ ...initial, status: "complete" })).rejects.toThrow("reminder cancellation unavailable")
  expect(signOut).not.toHaveBeenCalled()
  expect(deletionStorage.clear).not.toHaveBeenCalled()
})

it("does not send deletion or persist a new receipt under a changed account", async () => {
  mockCall.mockImplementationOnce(async () => { (auth as any).currentUser = { uid: "other" }; return { data: { secret: initial.secret } } })
  await expect(accountDeletionService.prepare("p1")).rejects.toThrow("could not be prepared")
  expect(stored).toBeNull()
  await expect(accountDeletionService.submit(initial)).rejects.toThrow("Verify this account")
  expect(mockCall).toHaveBeenCalledTimes(1)
})
