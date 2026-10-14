import { accountMergeService } from "../../src/services/accountMergeService"
import { mergeStorage, MergeReceipt } from "../../src/services/mergeStorage"
import { auth } from "../../src/services/firebaseClient"
import { updateCurrentUser } from "firebase/auth"
import { gameService } from "../../src/services/gameService"
import { sessionStorage } from "../../src/services/sessionStorage"
import { MergeIdentity } from "../../src/services/mergeIdentity"
const mockCall = jest.fn()
jest.mock("firebase/functions", () => ({ getFunctions: () => "primary", httpsCallable: (client: unknown, name: string) => (data: unknown) => mockCall(client, name, data) }))
jest.mock("firebase/auth", () => ({ updateCurrentUser: jest.fn() }))
jest.mock("../../src/services/firebaseClient", () => ({ app: {}, auth: { currentUser: null } }))
jest.mock("../../src/services/gameService", () => ({ gameService: { resumePendingAction: jest.fn(), clearLocalProgress: jest.fn() } }))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn() } }))
jest.mock("../../src/services/sessionStorage", () => ({ sessionStorage: { write: jest.fn() } }))
jest.mock("../../src/services/mergeStorage", () => ({ mergeStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }))
const initial: MergeReceipt = { sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001", status: "submitting" }
const identity = { user: { uid: "saved", isAnonymous: false, getIdToken: jest.fn() }, functions: "secondary", close: jest.fn() } as unknown as MergeIdentity
let stored: MergeReceipt | null
const status = (state = "pending", changes = {}) => ({ data: { status: state, jobId: "guest", targetUid: "saved", operationId: initial.operationId, imported: 2, conflicts: 1, ...changes } })
beforeEach(() => {
  jest.resetAllMocks()
  stored = { ...initial }
  ;(auth as any).currentUser = { uid: "guest", isAnonymous: true }
  ;(mergeStorage.read as jest.Mock).mockImplementation(async () => stored)
  ;(mergeStorage.write as jest.Mock).mockImplementation(async receipt => { stored = receipt })
  ;(mergeStorage.clear as jest.Mock).mockImplementation(async () => { stored = null })
  ;(identity.user.getIdToken as jest.Mock).mockResolvedValue("private-firebase-token")
  ;(updateCurrentUser as jest.Mock).mockImplementation(async (_auth, user) => { (auth as any).currentUser = user })
  mockCall.mockResolvedValue(status())
})
it("flushes pending moves and stores confirmation before any begin request, without credentials", async () => {
  stored = null
  mockCall.mockResolvedValueOnce({ data: { status: "none" } })
  const receipt = await accountMergeService.prepare("guest", identity)
  expect(gameService.resumePendingAction).toHaveBeenCalledWith("guest")
  expect(stored).toEqual(receipt)
  expect(stored).not.toHaveProperty("targetIdToken")
  expect(mockCall).toHaveBeenCalledTimes(1)
  mockCall.mockImplementation(async (_client, name, data) => {
    expect(stored?.operationId).toBe(data.operationId)
    expect(name).toBe("beginAccountMerge")
    return status("pending", { operationId: receipt.operationId })
  })
  await accountMergeService.submit(receipt, identity)
  expect(updateCurrentUser).not.toHaveBeenCalled()
})
it("does not issue begin if saving pending progress or confirmation fails", async () => {
  stored = null
  ;(gameService.resumePendingAction as jest.Mock).mockRejectedValueOnce(new Error("offline"))
  await expect(accountMergeService.prepare("guest", identity)).rejects.toThrow("offline")
  expect(mockCall).not.toHaveBeenCalled()
  mockCall.mockResolvedValue({ data: { status: "none" } })
  ;(mergeStorage.write as jest.Mock).mockRejectedValueOnce(new Error("disk full"))
  await expect(accountMergeService.prepare("guest", identity)).rejects.toThrow("disk full")
  expect(mockCall.mock.calls.every(([, name]) => name === "getAccountMergeStatus")).toBe(true)
})
it("retains the same confirmation across a lost response and retry", async () => {
  mockCall.mockRejectedValueOnce(new Error("response lost"))
  await expect(accountMergeService.submit(initial, identity)).rejects.toThrow("response lost")
  expect(stored).toEqual(initial)
  await accountMergeService.submit(initial, identity)
  expect(mockCall.mock.calls[0][2]).toEqual(mockCall.mock.calls[1][2])
})
it("uses the destination session for recovery after guest retirement", async () => {
  ;(auth as any).currentUser = null
  mockCall.mockResolvedValue(status("complete"))
  await expect(accountMergeService.refresh(initial, identity)).resolves.toMatchObject({ status: "complete" })
  expect(mockCall).toHaveBeenCalledWith("secondary", "getAccountMergeStatus", { jobId: "guest", operationId: initial.operationId })
})
it("refuses a different destination and does not overwrite the primary session", async () => {
  const wrong = { ...identity, user: { ...identity.user, uid: "other" } }
  await expect(accountMergeService.resume(initial, wrong)).rejects.toThrow("same saved account")
  expect(mockCall).not.toHaveBeenCalled()
  expect(updateCurrentUser).not.toHaveBeenCalled()
})
it.each(["pending", "review", "cancelled", "none"])("does not switch accounts based on local completion when the server says %s", async state => {
  stored = { ...initial, status: "complete" }
  mockCall.mockResolvedValue(status(state))
  await expect(accountMergeService.finish(stored, identity)).rejects.toThrow()
  expect(updateCurrentUser).not.toHaveBeenCalled()
  expect(mergeStorage.clear).not.toHaveBeenCalled()
})
it.each([{ operationId: "different-confirmation" }, { jobId: "other" }, { targetUid: "other" }, { imported: -1 }])("rejects an unrelated or malformed response %j", async changes => {
  mockCall.mockResolvedValue(status("complete", changes))
  await expect(accountMergeService.finish(initial, identity)).rejects.toThrow("did not match")
  expect(updateCurrentUser).not.toHaveBeenCalled()
})
it("persists the destination and clears only guest outbox before removing the recovery gate", async () => {
  mockCall.mockResolvedValue(status("complete"))
  ;(mergeStorage.clear as jest.Mock).mockImplementation(async () => {
    expect(auth.currentUser?.uid).toBe("saved")
    expect(sessionStorage.write).toHaveBeenCalledWith({ uid: "saved", isAnonymous: false })
    expect(gameService.clearLocalProgress).toHaveBeenCalledWith("guest")
    stored = null
  })
  await accountMergeService.finish(initial, identity)
  expect(stored).toBeNull()
})
it("keeps recovery after the account switch if local cleanup fails", async () => {
  mockCall.mockResolvedValue(status("complete"))
  ;(gameService.clearLocalProgress as jest.Mock).mockRejectedValueOnce(new Error("disk full"))
  await expect(accountMergeService.finish(initial, identity)).rejects.toThrow("disk full")
  expect(auth.currentUser?.uid).toBe("saved")
  expect(stored?.status).toBe("complete")
  expect(mergeStorage.clear).not.toHaveBeenCalled()
  await accountMergeService.finish(stored!, identity)
  expect(stored).toBeNull()
})
it("does not let cancellation clear an unknown or already processing operation", async () => {
  for (const state of ["none", "pending", "complete"]) {
    mockCall.mockResolvedValue(status(state))
    await expect(accountMergeService.dismissCancellation(initial, identity)).rejects.toThrow()
  }
  expect(mergeStorage.clear).not.toHaveBeenCalled()
})
it("leaves guest progress and session intact on confirmed cancellation", async () => {
  mockCall.mockResolvedValue(status("cancelled"))
  await accountMergeService.dismissCancellation(initial, identity)
  expect(auth.currentUser?.uid).toBe("guest")
  expect(gameService.clearLocalProgress).not.toHaveBeenCalled()
  expect(mergeStorage.clear).toHaveBeenCalledWith(initial.operationId)
})
it("discovers an accepted operation with the current account after reinstall", async () => {
  stored = null
  ;(auth as any).currentUser = identity.user
  await expect(accountMergeService.discover("saved")).resolves.toMatchObject({ ...initial, status: "pending" })
  expect((await mergeStorage.read())?.operationId).toBe(initial.operationId)
})
it("does not apply a late response after the local operation or account changes", async () => {
  mockCall.mockImplementation(async () => { stored = { ...initial, operationId: "new-confirmation-0001" }; return status("complete") })
  await expect(accountMergeService.refresh(initial, identity)).rejects.toThrow("operation changed")
  ;(auth as any).currentUser = { uid: "other" }
  await expect(accountMergeService.refresh(stored!, identity)).rejects.toThrow("account changed")
})

it("refreshes a rejected discovery once and uses the retried response", async () => {
  stored = null
  const refresh = jest.fn().mockResolvedValue("fresh-token")
  ;(auth as any).currentUser.getIdToken = refresh
  mockCall.mockRejectedValueOnce(Object.assign(new Error("expired"), { code: "functions/unauthenticated" }))
  await expect(accountMergeService.discover("guest")).resolves.toMatchObject({ status: "pending" })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledWith(true)
  expect(mockCall).toHaveBeenCalledTimes(2)
})

it.each(["functions/unavailable", "functions/permission-denied"])("does not refresh or discard credentials for %s", async code => {
  const user = auth.currentUser!
  const refresh = jest.fn()
  ;(user as any).getIdToken = refresh
  mockCall.mockRejectedValueOnce(Object.assign(new Error("failed"), { code }))
  await expect(accountMergeService.discover("guest")).rejects.toMatchObject({ code })
  expect(refresh).not.toHaveBeenCalled()
  expect(auth.currentUser).toBe(user)
})

it("does not loop or clear account state when a fresh token is also rejected", async () => {
  const refresh = jest.fn().mockResolvedValue("fresh-token")
  ;(auth as any).currentUser.getIdToken = refresh
  mockCall.mockRejectedValue(Object.assign(new Error("rejected"), { code: "functions/unauthenticated" }))
  await expect(accountMergeService.discover("guest")).rejects.toMatchObject({ code: "functions/unauthenticated" })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(mockCall).toHaveBeenCalledTimes(2)
  expect(auth.currentUser?.uid).toBe("guest")
  expect(mergeStorage.clear).not.toHaveBeenCalled()
})

it("does not retry discovery for a different session that arrives during refresh", async () => {
  stored = null
  ;(auth as any).currentUser.getIdToken = jest.fn(async () => {
    // Even a new session for the same UID must not receive the old result.
    ;(auth as any).currentUser = { uid: "guest", isAnonymous: true }
    return "token"
  })
  mockCall.mockRejectedValueOnce(Object.assign(new Error("expired"), { code: "functions/unauthenticated" }))
  await expect(accountMergeService.discover("guest")).rejects.toThrow("account changed")
  expect(mockCall).toHaveBeenCalledTimes(1)
  expect(mergeStorage.write).not.toHaveBeenCalled()
})
