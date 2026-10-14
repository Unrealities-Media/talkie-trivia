require("dotenv").config({ quiet: true })
const { readEnvironment } = require("./config/appEnvironment.cjs")

module.exports = () => {
  const env = readEnvironment()
  return {
    name: env.name, slug: "talkie-trivia", scheme: env.scheme, version: "1.0.0",
    orientation: "portrait", icon: "./assets/icon.png", userInterfaceStyle: "automatic",
    // No OTA delivery until versioned catalog/runtime compatibility is verified.
    updates: { enabled: false },
    plugins: [
      "expo-font", "expo-router",
      ["expo-secure-store", { faceIDPermission: false }],
      ["expo-splash-screen", { image: "./assets/splash.png", backgroundColor: "#ffffff", dark: { image: "./assets/splash.png", backgroundColor: "#121212" } }],
      "expo-notifications",
      "./plugins/withNotificationClock.cjs",
      ...(env.googleConfigured ? [["@react-native-google-signin/google-signin", {
        iosUrlScheme: `com.googleusercontent.apps.${env.google.iosClientId.replace(".apps.googleusercontent.com", "")}`,
      }]] : []),
      ["expo-build-properties", { android: { usesCleartextTraffic: env.emulator } }],
      "./plugins/withReleaseSigning.cjs",
      "./plugins/withNativeBuildPaths.cjs",
      "./plugins/withAndroidPageSize.cjs",
      "./plugins/withReactNativeSource.cjs",
      "./plugins/withFbjniSource.cjs",
    ],
    ios: {
      bundleIdentifier: env.id, supportsTablet: true, buildNumber: "1",
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: env.id, versionCode: 1,
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FFFFFF" },
      blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.RECORD_AUDIO", "android.permission.SYSTEM_ALERT_WINDOW"],
    },
    web: { favicon: "./assets/favicon.png" },
    extra: {
      eas: { projectId: "f8249bd1-1713-4519-8dce-d340e2f6e746" },
      router: { root: "src/app" }, appVariant: env.variant,
      firebaseUseEmulators: env.emulator, firebaseEmulatorHost: env.emulatorHost,
      firebaseApiKey: env.firebase.apiKey, firebaseAppId: env.firebase.appId,
      firebaseMessagingSenderId: env.firebase.messagingSenderId, firebaseProjectId: env.firebase.projectId,
      ...env.google, googleConfigured: env.googleConfigured,
    },
  }
}
