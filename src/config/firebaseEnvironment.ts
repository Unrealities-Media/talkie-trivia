import Constants from "expo-constants"
import { Platform } from "react-native"

const extra = Constants.expoConfig?.extra
export const useFirebaseEmulators = extra?.firebaseUseEmulators === true
export const firebaseEmulatorHost = extra?.firebaseEmulatorHost || (Platform.OS === "android" ? "10.0.2.2" : "localhost")

export function functionsBaseUrl(project: string) {
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(project)) throw new Error("Account service is not configured.")
  if (useFirebaseEmulators && !project.startsWith("demo-")) throw new Error("Emulator builds require a demo project.")
  return useFirebaseEmulators ? `http://${firebaseEmulatorHost}:5001/${project}/us-central1` : `https://us-central1-${project}.cloudfunctions.net`
}
