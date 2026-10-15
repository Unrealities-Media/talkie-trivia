import React from "react"
import { Text, Button } from "react-native"
import { render, screen, act, fireEvent } from "@testing-library/react-native"
import { AuthProvider, useAuth } from "../../src/contexts/authContext"
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth"
import { gameService } from "../../src/services/gameService"
import { analyticsService } from "../../src/utils/analyticsService"
import { useGameStore } from "../../src/state/gameStore"
import { deletionStorage, DeletionReceipt } from "../../src/services/deletionStorage"
import { accountDeletionService } from "../../src/services/accountDeletionService"
import { sessionStorage, SavedSession } from "../../src/services/sessionStorage"
jest.mock("../../src/services/mergeStorage", () => ({ mergeStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }))
jest.mock("../../src/services/accountMergeService", () => ({ accountMergeService: { discover: jest.fn() } }))
jest.mock("../../src/services/mergeIdentity", () => ({ openMergeIdentity: jest.fn() }))
jest.mock("../../src/config/firebaseEnvironment", () => ({ useFirebaseEmulators: false }))
jest.mock("firebase/auth")
jest.mock("../../src/services/gameService")
jest.mock("../../src/services/accountDeletionService", () => ({ accountDeletionService: { prepare: jest.fn(), submit: jest.fn(), refresh: jest.fn(), clearLocal: jest.fn() } }))
jest.mock("../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn(), write: jest.fn(), clear: jest.fn() } }))
jest.mock("../../src/services/sessionStorage", () => ({ sessionStorage: { read: jest.fn(), write: jest.fn(), clearFor: jest.fn() } }))
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/state/gameStore", () => ({ useGameStore: { getState: jest.fn() } }))
let mockAfterSignOut: () => Promise<void>
jest.mock("../../src/utils/hooks/useGoogleAuth", () => ({ useGoogleAuth: (_changed: unknown, afterSignOut: () => Promise<void>) => {
  mockAfterSignOut = afterSignOut
  return { isLoading: false, authError: "Optional sign-in failed", handleSignIn: jest.fn(), handleSignOut: jest.fn(), withDeletionVerification: async (_uid: string, action: () => Promise<void>) => action() }
} }))
const Consumer = () => {
  const auth = useAuth()
  return <><Text testID="status">{auth.loading ? "Loading" : "Ready"}</Text><Text testID="player">{auth.player?.id || "none"}</Text><Text testID="error">{auth.error || "none"}</Text><Text testID="account-error">{auth.accountError}</Text><Text testID="deletion">{auth.deletion?.status || "none"}</Text><Text testID="deletion-error">{auth.deletionError}</Text><Text testID="lost-session">{auth.lostSession?.uid || "none"}</Text><Button title="Retry" onPress={auth.retryAuthentication} /><Button title="Delete" onPress={auth.handleDeleteAccount} /><Button title="Check deletion" onPress={auth.refreshDeletion} /><Button title="New guest" onPress={auth.startNewGuest} /><Button title="Replace guest" onPress={auth.replaceLostSession} /></>
}
describe("Account session isolation", () => {
  let callback: (user: any) => Promise<void>
  const auth = { currentUser: null as any }
  const reset = jest.fn()
  let receipt: DeletionReceipt | null
  let saved: SavedSession | null
  beforeEach(() => {
    jest.resetAllMocks()
    auth.currentUser = null
    receipt = null
    saved = null
    ;(sessionStorage.read as jest.Mock).mockImplementation(async () => saved)
    ;(sessionStorage.write as jest.Mock).mockImplementation(async value => { saved = value })
    ;(deletionStorage.read as jest.Mock).mockImplementation(async () => receipt)
    ;(deletionStorage.clear as jest.Mock).mockImplementation(async () => { receipt = null })
    ;(accountDeletionService.refresh as jest.Mock).mockImplementation(async () => receipt)
    ;(getAuth as jest.Mock).mockReturnValue(auth)
    ;(useGameStore.getState as jest.Mock).mockReturnValue({ resetSession: reset })
    ;(onAuthStateChanged as jest.Mock).mockImplementation((_auth, cb) => { callback = cb; return jest.fn() })
    ;(gameService.ensurePlayerExists as jest.Mock).mockImplementation(async uid => ({ id: uid, name: "Player" }))
  })
  const renderProvider = () => render(<AuthProvider><Consumer /></AuthProvider>)
  it("does not automatically replace a deleted account with a new guest on restart", async () => {
    receipt = { uid: "old", secret: "a".repeat(64), status: "complete" }
    renderProvider()
    await act(() => callback(null))
    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
    expect(screen.getByTestId("deletion")).toHaveTextContent("complete")
    ;(signInAnonymously as jest.Mock).mockResolvedValueOnce({ user: { uid: "new", isAnonymous: true } })
    await act(async () => { fireEvent.press(screen.getByText("New guest")) })
    expect(accountDeletionService.clearLocal).toHaveBeenCalledWith(expect.objectContaining({ uid: "old" }))
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("player")).toHaveTextContent("new")
  })
  it("keeps deletion intent and clears visible gameplay when the response is lost", async () => {
    auth.currentUser = { uid: "a", isAnonymous: true }
    ;(accountDeletionService.prepare as jest.Mock).mockImplementation(async () => { receipt = { uid: "a", secret: "a".repeat(64), status: "prepared" }; return receipt })
    ;(accountDeletionService.submit as jest.Mock).mockImplementation(async () => { receipt = { ...receipt!, status: "submitting" }; throw new Error("lost") })
    renderProvider()
    await act(() => callback(auth.currentUser))
    await act(async () => { fireEvent.press(screen.getByText("Delete")) })
    expect(screen.getByTestId("player")).toHaveTextContent("none")
    expect(screen.getByTestId("deletion")).toHaveTextContent("submitting")
    expect(signInAnonymously).not.toHaveBeenCalled()
    ;(accountDeletionService.refresh as jest.Mock).mockImplementation(async () => { receipt = { ...receipt!, status: "complete" }; return receipt })
    await act(async () => { fireEvent.press(screen.getByText("Check deletion")) })
    expect(screen.getByTestId("deletion")).toHaveTextContent("complete")
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
  it("fails closed on unreadable deletion storage instead of starting a replacement guest", async () => {
    ;(deletionStorage.read as jest.Mock).mockRejectedValueOnce(new Error("secure store unavailable"))
    renderProvider()
    await act(() => callback(null))
    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(screen.getByTestId("error")).toHaveTextContent(/Check your connection/)
  })
  it("retains the receipt and does not start a guest if accepted deletion cleanup fails", async () => {
    receipt = { uid: "a", secret: "a".repeat(64), status: "complete" }
    ;(accountDeletionService.clearLocal as jest.Mock).mockRejectedValue(new Error("storage failed"))
    renderProvider()
    await act(() => callback(null))
    await act(async () => { fireEvent.press(screen.getByText("New guest")) })
    expect(deletionStorage.clear).not.toHaveBeenCalled()
    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(screen.getByTestId("deletion-error")).toHaveTextContent(/cleanup is unfinished/)
  })
  it("keeps optional sign-in errors out of the critical session error", async () => {
    renderProvider()
    await act(() => callback({ uid: "a", isAnonymous: true }))
    expect(screen.getByTestId("error")).toHaveTextContent("none")
    expect(screen.getByTestId("account-error")).toHaveTextContent("Optional sign-in failed")
  })
  it("rejects an old profile response after a new account has loaded", async () => {
    let finish!: (data: any) => void
    ;(gameService.ensurePlayerExists as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    renderProvider()
    let pending!: Promise<void>
    await act(async () => { pending = callback({ uid: "a" }) })
    await act(() => callback({ uid: "b" }))
    await act(async () => { finish({ id: "a" }); await pending })
    expect(screen.getByTestId("player")).toHaveTextContent("b")
    expect(reset).toHaveBeenCalledTimes(2)
  })
  it("clears old visible data on invalidation without silently creating a replacement guest", async () => {
    renderProvider()
    await act(() => callback({ uid: "a", isAnonymous: true }))
    await act(() => callback(null))
    expect(screen.getByTestId("player")).toHaveTextContent("none")
    expect(screen.getByTestId("lost-session")).toHaveTextContent("a")
    await act(async () => { fireEvent.press(screen.getByText("Retry")) })
    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(saved).toEqual({ uid: "a", isAnonymous: true })
  })
  it("keeps first-install guest play automatic and shares concurrent sign-in requests", async () => {
    renderProvider()
    let finish!: (data: any) => void
    ;(signInAnonymously as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    let first!: Promise<void>, second!: Promise<void>
    await act(async () => { first = callback(null) })
    await act(async () => { second = callback(null) })
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("status")).toHaveTextContent("Loading")
    await act(async () => { finish({ user: { uid: "guest", isAnonymous: true } }); await Promise.all([first, second]) })
    expect(screen.getByTestId("player")).toHaveTextContent("guest")
    expect(saved).toEqual({ uid: "guest", isAnonymous: true })
  })
  it("retains the recovery gate across restarts and failed replacement attempts", async () => {
    saved = { uid: "old", isAnonymous: true }
    const view = renderProvider()
    await act(() => callback(null))
    expect(signInAnonymously).not.toHaveBeenCalled()
    ;(signInAnonymously as jest.Mock).mockRejectedValueOnce(new Error("offline"))
    await act(async () => { fireEvent.press(screen.getByText("Replace guest")) })
    expect(saved.uid).toBe("old")
    view.unmount()
    renderProvider()
    await act(() => callback(null))
    expect(screen.getByTestId("lost-session")).toHaveTextContent("old")
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
  })
  it("creates one replacement only after an explicit choice and preserves other local data", async () => {
    saved = { uid: "old", isAnonymous: true }
    renderProvider()
    await act(() => callback(null))
    ;(signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "new", isAnonymous: true } })
    await act(async () => {
      fireEvent.press(screen.getByText("Replace guest"))
      fireEvent.press(screen.getByText("Replace guest"))
    })
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
    expect(saved).toEqual({ uid: "new", isAnonymous: true })
    expect(accountDeletionService.clearLocal).not.toHaveBeenCalled()
    expect(sessionStorage.clearFor).not.toHaveBeenCalled()
    expect(screen.getByTestId("player")).toHaveTextContent("new")
  })
  it("never creates a guest on an unreadable marker or exposes gameplay on failed marker persistence", async () => {
    renderProvider()
    ;(sessionStorage.read as jest.Mock).mockRejectedValueOnce(new Error("corrupt"))
    await act(() => callback(null))
    expect(signInAnonymously).not.toHaveBeenCalled()
    ;(sessionStorage.write as jest.Mock).mockRejectedValueOnce(new Error("disk full"))
    await act(() => callback({ uid: "old", isAnonymous: true }))
    expect(gameService.ensurePlayerExists).not.toHaveBeenCalled()
    await act(() => callback(null))
    expect(screen.getByTestId("lost-session")).toHaveTextContent("old")
    expect(signInAnonymously).not.toHaveBeenCalled()
  })
  it("lets a successful explicit sign-out start a guest without mistaking it for invalidation", async () => {
    renderProvider()
    await act(() => callback({ uid: "linked", isAnonymous: false }))
    ;(signInAnonymously as jest.Mock).mockResolvedValue({ user: { uid: "new", isAnonymous: true } })
    await act(() => mockAfterSignOut())
    expect(screen.getByTestId("player")).toHaveTextContent("new")
    expect(screen.getByTestId("lost-session")).toHaveTextContent("none")
  })
  it("does not replace a provider session that arrives during recovery", async () => {
    saved = { uid: "old", isAnonymous: false }
    renderProvider()
    await act(() => callback(null))
    auth.currentUser = { uid: "linked", isAnonymous: false }
    await act(async () => { fireEvent.press(screen.getByText("Replace guest")) })
    expect(signInAnonymously).not.toHaveBeenCalled()
    await act(() => callback(auth.currentUser))
    expect(saved.uid).toBe("linked")
    expect(screen.getByTestId("lost-session")).toHaveTextContent("none")
  })
  it("retries profile loading using the current authenticated account", async () => {
    auth.currentUser = { uid: "a", email: "private@example.com", displayName: "Private Name" }
    ;(gameService.ensurePlayerExists as jest.Mock).mockRejectedValueOnce(new Error("private@example.com"))
    renderProvider()
    await act(() => callback(auth.currentUser))
    expect(screen.getByTestId("error")).toHaveTextContent(/Check your connection/)
    await act(async () => { fireEvent.press(screen.getByText("Retry")) })
    expect(screen.getByTestId("player")).toHaveTextContent("a")
    expect(screen.getByTestId("error")).toHaveTextContent("none")
    expect(analyticsService.identifyUser).toHaveBeenCalledWith("a")
    expect(gameService.ensurePlayerExists).toHaveBeenCalledWith("a", "Player")
  })
})
