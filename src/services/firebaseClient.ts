import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore"
import {
  initializeAuth,
  getAuth,
  Auth,
  connectAuthEmulator,
} from "firebase/auth"
import * as FirebaseAuth from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { Platform } from "react-native"
import { useFirebaseEmulators, firebaseEmulatorHost } from "../config/firebaseEnvironment"

const firebaseConfig = {
  apiKey: Constants?.expoConfig?.extra?.firebaseApiKey,
  authDomain: `${Constants?.expoConfig?.extra?.firebaseProjectId}.firebaseapp.com`,
  projectId: Constants?.expoConfig?.extra?.firebaseProjectId,
  storageBucket: `${Constants?.expoConfig?.extra?.firebaseProjectId}.appspot.com`,
  messagingSenderId: Constants?.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants?.expoConfig?.extra?.firebaseAppId,
  measurementId: Constants?.expoConfig?.extra?.firebaseMeasurementId,
}

const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig)

if (useFirebaseEmulators && !firebaseConfig.projectId?.startsWith("demo-")) {
  throw new Error("Emulator builds require a demo Firebase project.")
}

let db: Firestore
let auth: Auth

try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: useFirebaseEmulators && Platform.OS === "android",
  })
} catch (e: any) {
  db = getFirestore(app)
}

if (Platform.OS === "web") {
  auth = getAuth(app)
} else {
  try {
    const { getReactNativePersistence } = FirebaseAuth as any

    if (getReactNativePersistence) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      })
    } else {
      auth = getAuth(app)
    }
  } catch (e: any) {
    // If auth is already initialized (hot reload), use existing instance
    auth = getAuth(app)
  }
}

if (useFirebaseEmulators) {
  const host = firebaseEmulatorHost
  // Persist successful setup across Fast Refresh. Never swallow connection
  // failures and accidentally continue with a partly live Firebase client.
  const state = globalThis as typeof globalThis & { __talkieEmulatorApps?: Set<FirebaseApp> }
  const connected = state.__talkieEmulatorApps ||= new Set<FirebaseApp>()
  if (!connected.has(app)) {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
    connectFirestoreEmulator(db, host, 8080)
    connectFunctionsEmulator(getFunctions(app), host, 5001)
    connected.add(app)
  }
}

export { app, db, auth }
