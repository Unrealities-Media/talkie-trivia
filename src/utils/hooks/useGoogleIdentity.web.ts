import { useCallback } from "react"
import Constants from "expo-constants"
import * as Google from "expo-auth-session/providers/google"
import * as WebBrowser from "expo-web-browser"
import { isLocalDemoIdentity, requestLocalDemoIdentity } from "../../services/localDemoIdentity"

WebBrowser.maybeCompleteAuthSession()

// Browser provider cookies belong to Google; Firebase owns our web session.
export async function clearGoogleIdentity(): Promise<void> {}

export function useGoogleIdentity() {
  const extra = Constants.expoConfig?.extra
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: extra?.webClientId || "google-sign-in-not-configured",
    webClientId: extra?.webClientId,
  })
  return useCallback(async (): Promise<string | null> => {
    if (isLocalDemoIdentity()) return requestLocalDemoIdentity()
    if (!extra?.googleConfigured) throw new Error("Google sign-in is not configured for this build.")
    if (!request) throw new Error("Google verification is unavailable. Try again shortly.")
    const response = await promptAsync()
    if (response.type === "cancel" || response.type === "dismiss") return null
    if (response.type !== "success" || !response.params.id_token) throw new Error("Google verification failed.")
    return response.params.id_token
  }, [extra?.googleConfigured, request, promptAsync])
}
