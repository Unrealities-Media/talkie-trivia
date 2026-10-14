import React from "react"
import { Text, Button } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AuthProvider, useAuth } from "../../src/contexts/authContext"
import { getAuth, onAuthStateChanged, signInAnonymously, updateCurrentUser, signOut } from "firebase/auth"
import { auth } from "../../src/services/firebaseClient"
import { mergeStorage } from "../../src/services/mergeStorage"
import { openMergeIdentity } from "../../src/services/mergeIdentity"
import { gameService } from "../../src/services/gameService"
import { sessionStorage } from "../../src/services/sessionStorage"
const mockCall = jest.fn()
let mockCollision: (uid: string, credential: any) => Promise<void>
jest.mock("firebase/functions", () => ({ getFunctions: () => "primary", httpsCallable: (client: unknown, name: string) => (data: unknown) => mockCall(client, name, data) }))
jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), onAuthStateChanged: jest.fn(), signInAnonymously: jest.fn(), updateCurrentUser: jest.fn(), signOut: jest.fn() }))
jest.mock("../../src/services/firebaseClient", () => ({ app: {}, auth: { currentUser: null } }))
jest.mock("../../src/services/gameService", () => ({ gameService: { resumePendingAction: jest.fn(), clearLocalProgress: jest.fn(), ensurePlayerExists: jest.fn() } }))
jest.mock("../../src/services/mergeIdentity", () => ({ openMergeIdentity: jest.fn() }))
jest.mock("../../src/services/accountDeletionService", () => ({ accountDeletionService: {} }))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn() } }))
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/state/gameStore", () => ({ useGameStore: { getState: () => ({ resetSession: jest.fn() }) } }))
jest.mock("../../src/config/firebaseEnvironment", () => ({ useFirebaseEmulators: true }))
jest.mock("../../src/utils/hooks/useGoogleAuth", () => ({ useGoogleAuth: (_changed: unknown, _out: unknown, collision: typeof mockCollision) => {
  mockCollision = collision
  return { isLoading: false, authError: null, verifyGoogleAccount: async (action: (credential: any) => Promise<void>) => action({ providerId: "google.com" }) }
} }))
const Consumer = () => {
  const state = useAuth()
  return <><Text testID="player">{state.player?.id || "none"}</Text><Text testID="merge">{state.merge?.status || "none"}</Text><Text testID="proposal">{state.mergeProposal?.sourceUid || "none"}</Text><Text testID="error">{state.mergeError || "none"}</Text>
    <Text testID="lost-session">{state.lostSession?.uid || "none"}</Text><Text testID="session-error">{state.error || "none"}</Text>
    <Button title="Retry account" onPress={state.retryAuthentication} />
    <Button title="Confirm" onPress={state.confirmMerge} /><Button title="Continue" onPress={state.continueMerge} /><Button title="Cancel" onPress={state.cancelMerge} /><Button title="Finish" onPress={state.finishMerge} />
  </>
}
const identity = { user: { uid: "saved", email: "saved@example.test", isAnonymous: false, getIdToken: jest.fn() }, functions: "secondary", close: jest.fn() }
let callback: (user: any) => Promise<void>
let server: any
beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  server = { status: "none" }
  ;(auth as any).currentUser = { uid: "guest", isAnonymous: true }
  ;(getAuth as jest.Mock).mockReturnValue(auth)
  ;(onAuthStateChanged as jest.Mock).mockImplementation((_auth, cb) => { callback = cb; return jest.fn() })
  ;(updateCurrentUser as jest.Mock).mockImplementation(async (_auth, user) => { (auth as any).currentUser = user; await callback(user) })
  ;(signOut as jest.Mock).mockImplementation(async () => { (auth as any).currentUser = null; await callback(null) })
  ;(openMergeIdentity as jest.Mock).mockResolvedValue(identity)
  identity.user.getIdToken.mockResolvedValue("token-not-persisted")
  ;(gameService.ensurePlayerExists as jest.Mock).mockImplementation(async uid => ({ id: uid }))
  mockCall.mockImplementation(async (_client, name, data) => {
    if (name === "getAccountMergeStatus" && !data.jobId && ["complete", "cancelled"].includes(server.status)) return { data: { status: "none" } }
    if (name === "beginAccountMerge") server = { status: "pending", jobId: "guest", targetUid: "saved", operationId: data.operationId, imported: 0, conflicts: 0 }
    if (name === "resumeAccountMerge") server = { ...server, status: "complete", imported: 3, conflicts: 1 }
    if (name === "cancelAccountMerge") server = { ...server, status: "cancelled" }
    return { data: server }
  })
})
const open = async () => { render(<AuthProvider><Consumer /></AuthProvider>); await act(() => callback(auth.currentUser)) }
const offer = async () => act(() => mockCollision("guest", { providerId: "google.com" }))
const press = async (label: string) => act(async () => { fireEvent.press(screen.getByText(label)) })
it("asks for consent and keeps the guest untouched when the player declines", async () => {
  await open(); await offer()
  expect(screen.getByTestId("proposal")).toHaveTextContent("guest")
  expect(screen.getByTestId("player")).toHaveTextContent("none")
  expect(await mergeStorage.read()).toBeNull()
  expect(mockCall.mock.calls.some(([, name]) => name === "beginAccountMerge")).toBe(false)
  await press("Cancel")
  expect(auth.currentUser?.uid).toBe("guest")
  expect(identity.close).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("player")).toHaveTextContent("guest")
})
it("recovers a lost begin response and missing guest auth, then opens the saved account only after completion", async () => {
  await open(); await offer()
  const normal = mockCall.getMockImplementation()!
  mockCall.mockImplementation(async (client, name, data) => {
    const response = await normal(client, name, data)
    if (name === "beginAccountMerge") throw new Error("response lost")
    return response
  })
  await press("Confirm")
  expect((await mergeStorage.read())?.status).toBe("submitting")
  expect(screen.getByTestId("player")).toHaveTextContent("none")
  ;(auth as any).currentUser = null
  await act(() => callback(null))
  expect(signInAnonymously).not.toHaveBeenCalled()
  await press("Continue")
  expect(screen.getByTestId("merge")).toHaveTextContent("complete")
  expect(updateCurrentUser).not.toHaveBeenCalled()
  await press("Finish")
  expect(auth.currentUser?.uid).toBe("saved")
  expect(await mergeStorage.read()).toBeNull()
  expect(screen.getByTestId("player")).toHaveTextContent("saved")
})
it("gates startup from a saved receipt and rejects recovery with the wrong Google account", async () => {
  await mergeStorage.write({ sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001", status: "pending" })
  ;(auth as any).currentUser = null
  ;(openMergeIdentity as jest.Mock).mockResolvedValueOnce({ ...identity, user: { ...identity.user, uid: "wrong" } })
  await open(); await press("Continue")
  expect(identity.close).toHaveBeenCalled()
  expect(signInAnonymously).not.toHaveBeenCalled()
  expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
  expect(screen.getByTestId("merge")).toHaveTextContent("pending")
  expect(screen.getByTestId("error")).toHaveTextContent(/same saved Google account/)
})
it("discovers an accepted merge on a different device before loading a player", async () => {
  ;(auth as any).currentUser = identity.user
  server = { status: "pending", jobId: "guest", targetUid: "saved", operationId: "confirmation-00001", imported: 0, conflicts: 0 }
  await open()
  expect((await mergeStorage.read())?.operationId).toBe(server.operationId)
  expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
  expect(screen.getByTestId("merge")).toHaveTextContent("pending")
})
it("does not discard an accepted operation when cancellation is no longer allowed", async () => {
  await open(); await offer(); await press("Confirm")
  mockCall.mockRejectedValue(new Error("copying already started"))
  await press("Cancel")
  expect((await mergeStorage.read())?.status).toBe("pending")
  expect(screen.getByTestId("player")).toHaveTextContent("none")
  expect(gameService.clearLocalProgress).not.toHaveBeenCalled()
})
it("requests fresh provider verification after a temporary destination session is revoked", async () => {
  await open(); await offer(); await press("Confirm")
  mockCall.mockRejectedValueOnce(Object.assign(new Error("revoked"), { code: "functions/unauthenticated" }))
  await press("Continue")
  expect(identity.close).toHaveBeenCalledTimes(1)
  expect((await mergeStorage.read())?.status).toBe("pending")
  await press("Continue")
  expect(openMergeIdentity).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId("merge")).toHaveTextContent("complete")
})
it("withdraws unaccepted consent using the original guest and only clears recovery after server confirmation", async () => {
  await open(); await offer()
  const normal = mockCall.getMockImplementation()!
  mockCall.mockImplementation(async (client, name, data) => {
    if (name === "beginAccountMerge") throw new Error("request lost before acceptance")
    if (name === "cancelAccountMerge") {
      expect(client).toBe("primary")
      expect(data.targetUid).toBe("saved")
      server = { status: "cancelled", jobId: "guest", targetUid: "saved", operationId: data.operationId, imported: 0, conflicts: 0 }
    }
    return normal(client, name, data)
  })
  await press("Confirm")
  expect((await mergeStorage.read())?.status).toBe("submitting")
  await press("Cancel")
  expect(await mergeStorage.read()).toBeNull()
  expect(auth.currentUser?.uid).toBe("guest")
  expect(screen.getByTestId("player")).toHaveTextContent("guest")
})
it("coalesces duplicate confirmation taps while the server response is pending", async () => {
  await open(); await offer()
  const normal = mockCall.getMockImplementation()!
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  mockCall.mockImplementation(async (client, name, data) => {
    if (name === "beginAccountMerge") await held
    return normal(client, name, data)
  })
  await press("Confirm"); await press("Confirm")
  expect(mockCall.mock.calls.filter(([, name]) => name === "beginAccountMerge")).toHaveLength(1)
  await act(async () => { release(); await held })
})

it("records continuity before discovery invalidates an imported session and retains recovery on retry/restart", async () => {
  const refresh = jest.fn(async () => {
    expect(await sessionStorage.read()).toEqual({ uid: "guest", isAnonymous: true })
    ;(auth as any).currentUser = null
    await callback(null) // Firebase's definitive refresh rejection notifies Auth.
    throw Object.assign(new Error("expired"), { code: "auth/user-token-expired" })
  })
  ;(auth as any).currentUser.getIdToken = refresh
  mockCall.mockRejectedValue(Object.assign(new Error("rejected"), { code: "functions/unauthenticated" }))
  const view = render(<AuthProvider><Consumer /></AuthProvider>)
  await act(() => callback(auth.currentUser))
  expect(refresh).toHaveBeenCalledWith(true)
  expect(screen.getByTestId("lost-session")).toHaveTextContent("guest")
  expect(screen.getByTestId("session-error")).toHaveTextContent("none")
  expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
  await press("Retry account")
  view.unmount()
  await open()
  expect(screen.getByTestId("lost-session")).toHaveTextContent("guest")
  expect(signInAnonymously).not.toHaveBeenCalled()
  expect(mockCall).toHaveBeenCalledTimes(1)
})

it("preserves a session on refresh network failure and recovers through account Retry", async () => {
  const user = auth.currentUser!
  ;(user as any).getIdToken = jest.fn().mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "auth/network-request-failed" }))
  mockCall.mockRejectedValueOnce(Object.assign(new Error("expired"), { code: "functions/unauthenticated" }))
  await open()
  expect(auth.currentUser).toBe(user)
  expect(screen.getByTestId("lost-session")).toHaveTextContent("none")
  expect(screen.getByTestId("session-error")).toHaveTextContent(/Check your connection/)
  expect(await sessionStorage.read()).toEqual({ uid: "guest", isAnonymous: true })
  await press("Retry account")
  expect(screen.getByTestId("player")).toHaveTextContent("guest")
  expect(signInAnonymously).not.toHaveBeenCalled()
})

it("does not contact discovery if continuity cannot be persisted", async () => {
  const write = jest.spyOn(sessionStorage, "write").mockRejectedValueOnce(new Error("disk full"))
  try {
    await open()
    expect(mockCall).not.toHaveBeenCalled()
    expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
    expect(screen.getByTestId("session-error")).toHaveTextContent(/Check your connection/)
    ;(auth as any).currentUser = null
    await act(() => callback(null))
    expect(screen.getByTestId("lost-session")).toHaveTextContent("guest")
    expect(signInAnonymously).not.toHaveBeenCalled()
  } finally { write.mockRestore() }
})

it("opens recovery when a refreshed token is definitively rejected without replacing the guest", async () => {
  const refresh = jest.fn().mockResolvedValue("fresh-but-revoked-token")
  ;(auth as any).currentUser.getIdToken = refresh
  mockCall.mockRejectedValue(Object.assign(new Error("invalid"), {
    code: "functions/unauthenticated", details: { reason: "session-invalid" },
  }))
  await open()
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(mockCall).toHaveBeenCalledTimes(2)
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("lost-session")).toHaveTextContent("guest")
  expect(screen.getByTestId("session-error")).toHaveTextContent("none")
  expect(await sessionStorage.read()).toEqual({ uid: "guest", isAnonymous: true })
  expect(gameService.clearLocalProgress).not.toHaveBeenCalled()
  expect(signInAnonymously).not.toHaveBeenCalled()
})

it("retains the session on ambiguous authentication failures even after refreshing", async () => {
  ;(auth as any).currentUser.getIdToken = jest.fn().mockResolvedValue("fresh-token")
  mockCall.mockRejectedValue(Object.assign(new Error("rejected"), { code: "functions/unauthenticated" }))
  await open()
  expect(signOut).not.toHaveBeenCalled()
  expect(auth.currentUser?.uid).toBe("guest")
  expect(screen.getByTestId("session-error")).toHaveTextContent(/Check your connection/)
})

it("keeps gameplay gated when local invalidation sign-out fails", async () => {
  ;(auth as any).currentUser.getIdToken = jest.fn().mockResolvedValue("fresh-token")
  ;(signOut as jest.Mock).mockRejectedValueOnce(new Error("storage failed"))
  mockCall.mockRejectedValue(Object.assign(new Error("invalid"), {
    code: "functions/unauthenticated", details: { reason: "session-invalid" },
  }))
  await open()
  expect(auth.currentUser?.uid).toBe("guest")
  expect(screen.getByTestId("player")).toHaveTextContent("none")
  expect(screen.getByTestId("session-error")).toHaveTextContent(/Check your connection/)
  await press("Retry account")
  expect(screen.getByTestId("lost-session")).toHaveTextContent("guest")
  expect(signInAnonymously).not.toHaveBeenCalled()
})
