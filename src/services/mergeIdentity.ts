import { initializeApp, deleteApp } from "firebase/app"
import { AuthCredential, connectAuthEmulator, initializeAuth, inMemoryPersistence, signInWithCredential } from "firebase/auth"
import { connectFunctionsEmulator, getFunctions } from "firebase/functions"
import uuid from "react-native-uuid"
import { app } from "./firebaseClient"
import { firebaseEmulatorHost, useFirebaseEmulators } from "../config/firebaseEnvironment"

/** No primary auth change or persistent destination credentials before consent. */
export async function openMergeIdentity(credential: AuthCredential) {
  const temporary = initializeApp(app.options, `merge-${uuid.v4()}`)
  try {
    const auth = initializeAuth(temporary, { persistence: inMemoryPersistence })
    const functions = getFunctions(temporary)
    if (useFirebaseEmulators) {
      if (!temporary.options.projectId?.startsWith("demo-")) throw new Error("Invalid emulator project.")
      connectAuthEmulator(auth, `http://${firebaseEmulatorHost}:9099`, { disableWarnings: true })
      connectFunctionsEmulator(functions, firebaseEmulatorHost, 5001)
    }
    const { user } = await signInWithCredential(auth, credential)
    if (user.isAnonymous) throw new Error("Verify your saved account.")
    return { user, functions, close: () => deleteApp(temporary) }
  } catch (error) {
    await deleteApp(temporary)
    throw error
  }
}
export type MergeIdentity = Awaited<ReturnType<typeof openMergeIdentity>>
