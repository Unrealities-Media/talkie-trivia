import Constants from "expo-constants"
import { Platform } from "react-native"
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth"

/** Test identities are available only in a development browser on loopback. */
export function isLocalDemoIdentity() {
  const extra = Constants.expoConfig?.extra
  return __DEV__ && Platform.OS === "web" && extra?.appVariant === "development" &&
    extra?.firebaseUseEmulators === true && extra?.firebaseProjectId === "demo-talkie-trivia" &&
    [undefined, "localhost", "127.0.0.1"].includes(extra?.firebaseEmulatorHost)
}

function requireDemoAuth() {
  if (!isLocalDemoIdentity()) throw new Error("Local demo identities are disabled.")
  const auth = getAuth()
  if (auth.app.options.projectId !== "demo-talkie-trivia" ||
      !["localhost", "127.0.0.1"].includes(auth.emulatorConfig?.host || "") || auth.emulatorConfig?.port !== 9099) {
    throw new Error("Local identities require the loopback Auth emulator.")
  }
  return auth
}

function identity(name: string) {
  return { sub: `talkie-demo-${name}`, email: `${name}@example.test`, email_verified: true, name: `Demo ${name}` }
}

const rememberedNameKey = "talkie-local-demo-name"
function rememberName(name: string) {
  try { window.localStorage?.setItem(rememberedNameKey, name) } catch { /* Optional convenience only. */ }
}

export function requestLocalDemoIdentity(): string | null {
  requireDemoAuth()
  let remembered = "player-one"
  try { remembered = window.localStorage?.getItem(rememberedNameKey) || remembered } catch { /* Optional. */ }
  const current = getAuth().currentUser?.email?.endsWith("@example.test")
    ? getAuth().currentUser!.email!.split("@")[0] : remembered
  const value = window.prompt("Local demo sign-in (no Google account). Enter a test name; reuse it to reopen the same account.", current)
  if (value === null) return null
  const name = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw new Error("Use a demo name with letters, numbers and hyphens.")
  rememberName(name)
  // Firebase documents JSON mock provider tokens for its Auth emulator.
  return JSON.stringify(identity(name))
}

export async function linkAndRestoreLocalGuest(uid: string) {
  const auth = requireDemoAuth()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || auth.currentUser) throw new Error("Reopen recovery before restoring a local guest.")
  const name = `recovered-${uid.toLowerCase()}`
  const provider = identity(name)
  const admin = async (operation: string, data: unknown) => {
    const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-talkie-trivia/accounts:${operation}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
      body: JSON.stringify(data), signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error("The local Auth emulator could not restore this guest.")
    return response.json()
  }
  const { users } = await admin("lookup", { localId: [uid] })
  const user = users?.find((item: { localId: string }) => item.localId === uid)
  if (!user || user.disabled) throw new Error("This guest is missing from the local export. Start a separate guest or restore the matching export.")
  if (user.providerUserInfo?.some((item: { rawId: string }) => item.rawId !== provider.sub)) {
    throw new Error("This account is already linked. Sign in with its demo name instead.")
  }
  await admin("update", { localId: uid, email: provider.email, emailVerified: true,
    displayName: provider.name,
    linkProviderUserInfo: { providerId: "google.com", rawId: provider.sub, email: provider.email, displayName: provider.name } })
  if (auth.currentUser) throw new Error("Your account changed. Reopen recovery before continuing.")
  await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(provider)))
  rememberName(name)
}
