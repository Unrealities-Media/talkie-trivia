import { initializeApp, deleteApp } from "firebase/app"
import { initializeAuth, inMemoryPersistence, signInWithCredential, connectAuthEmulator } from "firebase/auth"
import { openMergeIdentity } from "../../src/services/mergeIdentity"
jest.mock("firebase/app", () => ({ initializeApp: jest.fn(), deleteApp: jest.fn() }))
jest.mock("firebase/auth", () => ({ initializeAuth: jest.fn(), inMemoryPersistence: "memory-only", signInWithCredential: jest.fn(), connectAuthEmulator: jest.fn() }))
jest.mock("firebase/functions", () => ({ getFunctions: jest.fn(), connectFunctionsEmulator: jest.fn() }))
jest.mock("../../src/services/firebaseClient", () => ({ app: { options: { projectId: "demo-talkie-trivia-test" } } }))
jest.mock("../../src/config/firebaseEnvironment", () => ({ useFirebaseEmulators: true, firebaseEmulatorHost: "test-host" }))
const temporary = { options: { projectId: "demo-talkie-trivia-test" } }
const auth = { currentUser: null }
beforeEach(() => {
  jest.clearAllMocks()
  ;(initializeApp as jest.Mock).mockReturnValue(temporary)
  ;(initializeAuth as jest.Mock).mockReturnValue(auth)
  ;(signInWithCredential as jest.Mock).mockResolvedValue({ user: { uid: "saved", isAnonymous: false } })
})
it("uses a named, memory-only Auth instance with explicit emulator routing", async () => {
  const credential = { providerId: "google.com", signInMethod: "google.com", toJSON: () => ({}) }
  const identity = await openMergeIdentity(credential)
  expect(initializeApp).toHaveBeenCalledWith(temporary.options, expect.stringMatching(/^merge-/))
  expect(initializeAuth).toHaveBeenCalledWith(temporary, { persistence: inMemoryPersistence })
  expect(connectAuthEmulator).toHaveBeenCalledWith(auth, "http://test-host:9099", { disableWarnings: true })
  expect(signInWithCredential).toHaveBeenCalledWith(auth, credential)
  expect(deleteApp).not.toHaveBeenCalled()
  await identity.close()
  expect(deleteApp).toHaveBeenCalledWith(temporary)
})
it("destroys temporary Auth if verification fails", async () => {
  ;(signInWithCredential as jest.Mock).mockRejectedValueOnce(new Error("offline"))
  await expect(openMergeIdentity({} as any)).rejects.toThrow("offline")
  expect(deleteApp).toHaveBeenCalledWith(temporary)
})
