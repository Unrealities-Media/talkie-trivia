import { renderHook, act } from "@testing-library/react-native"
import { useGoogleAuth } from "../../../src/utils/hooks/useGoogleAuth"
import { clearGoogleIdentity, useGoogleIdentity } from "../../../src/utils/hooks/useGoogleIdentity"
import { getAuth, linkWithCredential, signInWithCredential, signOut, GoogleAuthProvider, reauthenticateWithCredential } from "firebase/auth"
import { gameService } from "../../../src/services/gameService"
import { mergeStorage } from "../../../src/services/mergeStorage"
jest.mock("../../../src/services/mergeStorage", () => ({ mergeStorage: { read: jest.fn() } }))
jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), linkWithCredential: jest.fn(), signInWithCredential: jest.fn(), reauthenticateWithCredential: jest.fn(), signOut: jest.fn(), GoogleAuthProvider: { credential: jest.fn() } }))
jest.mock("../../../src/services/deletionStorage", () => ({ deletionStorage: { read: jest.fn() } }))
jest.mock("../../../src/utils/analyticsService")
jest.mock("../../../src/services/gameService", () => ({ gameService: { resumePendingAction: jest.fn() } }))
jest.mock("expo-constants", () => ({ expoConfig: { extra: { webClientId: "web-id" } } }))
jest.mock("../../../src/utils/hooks/useGoogleIdentity", () => ({ useGoogleIdentity: jest.fn(), clearGoogleIdentity: jest.fn() }))

describe("Google account transitions", () => {
  const guest = { uid: "guest", isAnonymous: true }
  const auth = { currentUser: guest as typeof guest | null }
  const changed = jest.fn()
  const prompt = jest.fn()
  beforeEach(() => {
    jest.resetAllMocks()
    auth.currentUser = guest
    ;(getAuth as jest.Mock).mockReturnValue(auth)
    ;(GoogleAuthProvider.credential as jest.Mock).mockReturnValue({ providerId: "google.com" })
    ;(useGoogleIdentity as jest.Mock).mockReturnValue(prompt)
    ;(gameService.resumePendingAction as jest.Mock).mockResolvedValue(null)
    ;(linkWithCredential as jest.Mock).mockResolvedValue({ user: { ...guest, isAnonymous: false } })
    prompt.mockResolvedValue("token")
  })
  it("links a guest in place instead of abandoning their UID", async () => {
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(gameService.resumePendingAction).toHaveBeenCalledWith("guest")
    expect(linkWithCredential).toHaveBeenCalledWith(guest, expect.anything())
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(changed).toHaveBeenCalledWith({ uid: "guest", isAnonymous: false })
    expect(result.current.isLoading).toBe(false)
  })
  it("reauthenticates the same linked user before deletion without signing into another account", async () => {
    const linked = { uid: "linked", isAnonymous: false, getIdToken: jest.fn().mockResolvedValue("fresh") }
    auth.currentUser = linked
    const operation = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.withDeletionVerification("linked", operation))
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(linked, expect.anything())
    expect(linked.getIdToken).toHaveBeenCalledWith(true)
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledTimes(1)
  })
  it("never deletes when provider verification is cancelled or changes the account", async () => {
    auth.currentUser = { uid: "linked", isAnonymous: false }
    const operation = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed))
    prompt.mockResolvedValueOnce(null)
    await act(async () => { await expect(result.current.withDeletionVerification("linked", operation)).rejects.toThrow("cancelled") })
    prompt.mockImplementationOnce(async () => { auth.currentUser = guest; return "token" })
    await act(async () => { await expect(result.current.withDeletionVerification("linked", operation)).rejects.toThrow("verification failed") })
    expect(operation).not.toHaveBeenCalled()
  })
  it("keeps guest progress when the credential already belongs to an account", async () => {
    ;(linkWithCredential as jest.Mock).mockRejectedValue({ code: "auth/credential-already-in-use", message: "private@example.com" })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    expect(auth.currentUser).toBe(guest)
    expect(result.current.authError).toContain("guest progress is safe")
    expect(result.current.authError).not.toContain("private@example.com")
  })
  it("offers a collision for explicit merge confirmation without changing the guest session", async () => {
    ;(linkWithCredential as jest.Mock).mockRejectedValue({ code: "auth/credential-already-in-use" })
    const collision = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed, undefined, collision))
    await act(() => result.current.handleSignIn())
    expect(collision).toHaveBeenCalledWith("guest", { providerId: "google.com" })
    expect(signInWithCredential).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    expect(auth.currentUser).toBe(guest)
  })
  it("blocks ordinary sign-in, sign-out and deletion while a durable merge exists", async () => {
    ;(mergeStorage.read as jest.Mock).mockResolvedValue({ operationId: "confirmed-00000001" })
    const operation = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    await act(() => result.current.handleSignOut())
    await act(async () => { await expect(result.current.withDeletionVerification("guest", operation)).rejects.toThrow("combining") })
    expect(prompt).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
    expect(operation).not.toHaveBeenCalled()
  })
  it("treats cancellation as a normal outcome", async () => {
    prompt.mockResolvedValue(null)
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(linkWithCredential).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ isLoading: false, authError: null })
  })
  it("ignores a provider response after another session replaced the guest", async () => {
    prompt.mockImplementation(async () => { auth.currentUser = { uid: "other", isAnonymous: false }; return "token" })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(linkWithCredential).not.toHaveBeenCalled()
    expect(signInWithCredential).not.toHaveBeenCalled()
  })
  it("keeps the session when pending progress cannot be saved before sign-out", async () => {
    ;(gameService.resumePendingAction as jest.Mock).mockRejectedValue(new Error("offline"))
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignOut())
    expect(signOut).not.toHaveBeenCalled()
    expect(result.current.authError).toContain("pending progress")
  })
  it("does not open the provider if saving pending progress changed the session", async () => {
    ;(gameService.resumePendingAction as jest.Mock).mockImplementation(async () => {
      auth.currentUser = { uid: "other", isAnonymous: false }
    })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(prompt).not.toHaveBeenCalled()
    expect(linkWithCredential).not.toHaveBeenCalled()
    expect(signInWithCredential).not.toHaveBeenCalled()
  })
  it("keeps pending guest progress and never opens the provider when saving fails", async () => {
    ;(gameService.resumePendingAction as jest.Mock).mockRejectedValue(new Error("offline"))
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(prompt).not.toHaveBeenCalled()
    expect(auth.currentUser).toBe(guest)
  })
  it("reopens a linked profile when recovery has no active Firebase session", async () => {
    auth.currentUser = null
    ;(signInWithCredential as jest.Mock).mockImplementation(async () => {
      auth.currentUser = { uid: "returning", isAnonymous: false }
      return { user: auth.currentUser }
    })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(linkWithCredential).not.toHaveBeenCalled()
    expect(signInWithCredential).toHaveBeenCalledWith(auth, expect.anything())
    expect(changed).toHaveBeenCalledWith({ uid: "returning", isAnonymous: false })
  })
  it("never deletes when Firebase rejects reauthentication with a different provider account", async () => {
    const linked = { uid: "linked", isAnonymous: false, getIdToken: jest.fn() }
    auth.currentUser = linked
    ;(reauthenticateWithCredential as jest.Mock).mockRejectedValue({ code: "auth/user-mismatch" })
    const operation = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(async () => { await expect(result.current.withDeletionVerification("linked", operation)).rejects.toMatchObject({ code: "auth/user-mismatch" }) })
    expect(linked.getIdToken).not.toHaveBeenCalled()
    expect(operation).not.toHaveBeenCalled()
  })
  it("does not restore the guest if the account changes during credential linking", async () => {
    ;(linkWithCredential as jest.Mock).mockImplementation(async () => {
      auth.currentUser = { uid: "other", isAnonymous: false }
      return { user: { ...guest, isAnonymous: false } }
    })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignIn())
    expect(changed).not.toHaveBeenCalled()
    expect(auth.currentUser?.uid).toBe("other")
  })
  it("saves pending progress before sign-out", async () => {
    const signedOut = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed, signedOut))
    await act(() => result.current.handleSignOut())
    expect(signOut).toHaveBeenCalledWith(auth)
    expect((gameService.resumePendingAction as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((signOut as jest.Mock).mock.invocationCallOrder[0])
    expect(signedOut).toHaveBeenCalledTimes(1)
    expect((signOut as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(signedOut.mock.invocationCallOrder[0])
  })
  it("does not authorize a replacement guest when sign-out fails", async () => {
    const signedOut = jest.fn()
    ;(signOut as jest.Mock).mockRejectedValueOnce(new Error("storage unavailable"))
    const { result } = renderHook(() => useGoogleAuth(changed, signedOut))
    await act(() => result.current.handleSignOut())
    expect(signedOut).not.toHaveBeenCalled()
  })
  it("clears the native provider cache before ending the Firebase session", async () => {
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignOut())
    expect(clearGoogleIdentity).toHaveBeenCalledTimes(1)
    expect((gameService.resumePendingAction as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((clearGoogleIdentity as jest.Mock).mock.invocationCallOrder[0])
    expect((clearGoogleIdentity as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((signOut as jest.Mock).mock.invocationCallOrder[0])
  })
  it("retains Firebase access if clearing the native provider cache fails", async () => {
    ;(clearGoogleIdentity as jest.Mock).mockRejectedValue(new Error("provider cache unavailable"))
    const signedOut = jest.fn()
    const { result } = renderHook(() => useGoogleAuth(changed, signedOut))
    await act(() => result.current.handleSignOut())
    expect(signOut).not.toHaveBeenCalled()
    expect(signedOut).not.toHaveBeenCalled()
    expect(auth.currentUser).toBe(guest)
  })
  it("does not sign out another Firebase session that arrives during provider cleanup", async () => {
    ;(clearGoogleIdentity as jest.Mock).mockImplementation(async () => { auth.currentUser = { uid: "other", isAnonymous: false } })
    const { result } = renderHook(() => useGoogleAuth(changed))
    await act(() => result.current.handleSignOut())
    expect(signOut).not.toHaveBeenCalled()
  })
  it("suppresses duplicate sign-in taps and reports prompt failures without raw errors", async () => {
    let reject!: (error: Error) => void
    prompt.mockImplementation(() => new Promise((_, fail) => { reject = fail }))
    const { result } = renderHook(() => useGoogleAuth(changed))
    let pending!: Promise<void>
    await act(async () => { pending = result.current.handleSignIn(); await Promise.resolve(); await result.current.handleSignIn() })
    expect(prompt).toHaveBeenCalledTimes(1)
    await act(async () => { reject(new Error("private@example.com")); await pending })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.authError).not.toContain("private@example.com")
  })
})
