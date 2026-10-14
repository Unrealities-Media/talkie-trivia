import Constants from "expo-constants"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import { clearGoogleIdentity, useGoogleIdentity } from "../../../src/utils/hooks/useGoogleIdentity"

jest.mock("expo-constants", () => ({ expoConfig: { extra: {
  googleConfigured: true, webClientId: "web-id", iosClientId: "ios-id",
} } }))
jest.mock("@react-native-google-signin/google-signin", () => ({ GoogleSignin: {
  configure: jest.fn(), hasPlayServices: jest.fn(), signOut: jest.fn(), signIn: jest.fn(),
} }))

const extra = Constants.expoConfig!.extra!
beforeEach(() => {
  jest.clearAllMocks()
  extra.googleConfigured = true
  ;(GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true)
  ;(GoogleSignin.signOut as jest.Mock).mockResolvedValue(null)
  ;(GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: "success", data: { idToken: "native-token" } })
})

it("configures the native SDK once and requests a fresh account choice without extra API access", async () => {
  const request = useGoogleIdentity()
  expect(await request()).toBe("native-token")
  expect(await request()).toBe("native-token")
  expect(GoogleSignin.configure).toHaveBeenCalledTimes(1)
  expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: "web-id", iosClientId: "ios-id", offlineAccess: false })
  expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true })
  expect(GoogleSignin.signOut).toHaveBeenCalledTimes(2)
  expect((GoogleSignin.signOut as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((GoogleSignin.signIn as jest.Mock).mock.invocationCallOrder[0])
})
it("normalizes native cancellation without producing a credential", async () => {
  ;(GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: "cancelled", data: null })
  expect(await useGoogleIdentity()()).toBeNull()
})
it("rejects a response without an ID token", async () => {
  ;(GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: "success", data: { idToken: null } })
  await expect(useGoogleIdentity()()).rejects.toThrow("identity token")
})
it.each([false, "reject"])("does not launch sign-in when Play services are unavailable (%s)", async outcome => {
  if (outcome === false) (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(false)
  else (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(new Error("services unavailable"))
  await expect(useGoogleIdentity()()).rejects.toThrow()
  expect(GoogleSignin.signIn).not.toHaveBeenCalled()
  expect(GoogleSignin.signOut).not.toHaveBeenCalled()
})
it("does not reuse the cached selection after provider sign-out fails", async () => {
  ;(GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error("native failure"))
  await expect(useGoogleIdentity()()).rejects.toThrow("native failure")
  expect(GoogleSignin.signIn).not.toHaveBeenCalled()
})
it("keeps guest-only builds usable without invoking a provider", async () => {
  extra.googleConfigured = false
  const request = useGoogleIdentity()
  expect(GoogleSignin.configure).not.toHaveBeenCalled()
  await expect(request()).rejects.toThrow("not configured")
  expect(GoogleSignin.signIn).not.toHaveBeenCalled()
})
it("clears provider state without opening a sign-in prompt", async () => {
  await clearGoogleIdentity()
  expect(GoogleSignin.signOut).toHaveBeenCalledTimes(1)
  expect(GoogleSignin.signIn).not.toHaveBeenCalled()
})
it("does not require provider setup to sign out of a guest-only build", async () => {
  extra.googleConfigured = false
  await clearGoogleIdentity()
  expect(GoogleSignin.signOut).not.toHaveBeenCalled()
})
