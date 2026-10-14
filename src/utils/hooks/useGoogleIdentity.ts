import Constants from "expo-constants"

let configured = false

function getProvider() {
  const extra = Constants.expoConfig?.extra
  if (!extra?.googleConfigured || !extra.webClientId || !extra.iosClientId) {
    throw new Error("Google sign-in is not configured for this build.")
  }
  // Guest play also works in a development host without this native module.
  // Load it only after an explicitly configured provider operation is requested.
  const { GoogleSignin }: typeof import("@react-native-google-signin/google-signin") = require("@react-native-google-signin/google-signin")
  if (!configured) {
    GoogleSignin.configure({
      webClientId: extra.webClientId,
      iosClientId: extra.iosClientId,
      offlineAccess: false,
    })
    configured = true
  }
  return GoogleSignin
}

export async function clearGoogleIdentity(): Promise<void> {
  if (!Constants.expoConfig?.extra?.googleConfigured) return
  await getProvider().signOut()
}

async function requestIdentity(): Promise<string | null> {
  const GoogleSignin = getProvider()
  if (!await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })) {
    throw new Error("Google Play services are unavailable.")
  }
  // Reset only the provider SDK's selection. Firebase remains authenticated until
  // the caller explicitly links, reauthenticates or switches its own session.
  // This also permits choosing another account after a cancelled/failed link.
  await GoogleSignin.signOut()
  const response = await GoogleSignin.signIn()
  if (response.type === "cancelled") return null
  const token = response.data.idToken
  if (!token) throw new Error("Google did not return an identity token.")
  return token
}

/** Metro selects the browser adapter only for web builds. */
export function useGoogleIdentity() {
  return requestIdentity
}
