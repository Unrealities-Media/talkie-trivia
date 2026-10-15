import { renderHook, act } from "@testing-library/react-native"
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google"
import { useGoogleIdentity } from "../../../src/utils/hooks/useGoogleIdentity.web"
jest.mock("expo-constants", () => ({ expoConfig: { extra: { googleConfigured: true, webClientId: "web-id", publicSiteUrl: "https://beta.example.com" } } }))
jest.mock("expo-auth-session/providers/google", () => ({ useIdTokenAuthRequest: jest.fn() }))
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }))
const prompt = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  ;(useIdTokenAuthRequest as jest.Mock).mockReturnValue([{}, null, prompt])
})
it("returns the browser ID token", async () => {
  prompt.mockResolvedValue({ type: "success", params: { id_token: "web-token" } })
  const { result } = renderHook(useGoogleIdentity)
  expect(useIdTokenAuthRequest).toHaveBeenCalledWith(expect.objectContaining({ redirectUri: "https://beta.example.com/" }))
  await act(async () => { expect(await result.current()).toBe("web-token") })
})
it.each(["cancel", "dismiss"])("normalizes browser %s", async type => {
  prompt.mockResolvedValue({ type })
  const { result } = renderHook(useGoogleIdentity)
  await act(async () => { expect(await result.current()).toBeNull() })
})
it.each([{ type: "error" }, { type: "success", params: {} }])("rejects unsuccessful browser response %j", async response => {
  prompt.mockResolvedValue(response)
  const { result } = renderHook(useGoogleIdentity)
  await act(async () => { await expect(result.current()).rejects.toThrow("verification failed") })
})
it("waits for the browser request to be available", async () => {
  ;(useIdTokenAuthRequest as jest.Mock).mockReturnValue([null, null, prompt])
  const { result } = renderHook(useGoogleIdentity)
  await act(async () => { await expect(result.current()).rejects.toThrow("unavailable") })
  expect(prompt).not.toHaveBeenCalled()
})
