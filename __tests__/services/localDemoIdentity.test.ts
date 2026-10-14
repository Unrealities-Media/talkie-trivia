import Constants from "expo-constants"
import { Platform } from "react-native"
import { getAuth, signInWithCredential } from "firebase/auth"
import { isLocalDemoIdentity, linkAndRestoreLocalGuest, requestLocalDemoIdentity } from "../../src/services/localDemoIdentity"
jest.mock("expo-constants", () => ({ expoConfig: { extra: {} } }))
jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), signInWithCredential: jest.fn(), GoogleAuthProvider: { credential: jest.fn(value => value) } }))
const valid = { appVariant: "development", firebaseUseEmulators: true, firebaseProjectId: "demo-talkie-trivia", firebaseEmulatorHost: "localhost" }
const platform = Platform.OS
const originalFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = "web"
  Constants.expoConfig!.extra = { ...valid }
  ;(getAuth as jest.Mock).mockReturnValue({ app: { options: { projectId: "demo-talkie-trivia" } }, emulatorConfig: { host: "localhost", port: 9099 }, currentUser: null })
  global.fetch = jest.fn()
})
afterEach(() => { Platform.OS = platform; global.fetch = originalFetch })
it.each([
  { ...valid, appVariant: "production" }, { ...valid, firebaseUseEmulators: false },
  { ...valid, firebaseProjectId: "real-project" }, { ...valid, firebaseEmulatorHost: "remote.example.com" },
])("blocks test credentials outside the exact development config: %j", async extra => {
  Constants.expoConfig!.extra = extra
  expect(isLocalDemoIdentity()).toBe(false)
  expect(() => requestLocalDemoIdentity()).toThrow("disabled")
  await expect(linkAndRestoreLocalGuest("guest-one")).rejects.toThrow("disabled")
  expect(global.fetch).not.toHaveBeenCalled()
  expect(signInWithCredential).not.toHaveBeenCalled()
})
it("blocks a live SDK instance even if the build configuration claims to be local", () => {
  ;(getAuth as jest.Mock).mockReturnValue({ app: { options: { projectId: "demo-talkie-trivia" } }, emulatorConfig: null })
  expect(() => requestLocalDemoIdentity()).toThrow("loopback")
})
it("does not recreate guests missing from an export or overwrite linked identities", async () => {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })
  await expect(linkAndRestoreLocalGuest("missing")).rejects.toThrow("missing")
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ localId: "linked", providerUserInfo: [{ rawId: "other-provider-id" }] }] }) })
  await expect(linkAndRestoreLocalGuest("linked")).rejects.toThrow("already linked")
  expect(signInWithCredential).not.toHaveBeenCalled()
  expect(global.fetch).toHaveBeenCalledTimes(2)
})
it("links an existing guest in the local emulator before signing in with the same fake identity", async () => {
  ;(global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ localId: "guest-one" }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
  await linkAndRestoreLocalGuest("guest-one")
  const [url, options] = (global.fetch as jest.Mock).mock.calls[1]
  expect(url).toBe("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-talkie-trivia/accounts:update")
  const update = JSON.parse(options.body)
  expect(update.localId).toBe("guest-one")
  expect(JSON.parse((signInWithCredential as jest.Mock).mock.calls[0][1]).sub).toBe(update.linkProviderUserInfo.rawId)
})
