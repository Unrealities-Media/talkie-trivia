require("dotenv").config()

const IS_DEV = process.env.APP_VARIANT === "development"
const IS_PREVIEW = process.env.APP_VARIANT === "preview"

// 1. Identity Logic
const getAppName = () => {
  if (IS_DEV) return "Talkie Dev"
  if (IS_PREVIEW) return "Talkie Alpha"
  return "Talkie Trivia"
}

const getBundleIdentifier = () => {
  return IS_DEV
    ? "com.unrealities.talkietrivia.dev"
    : "com.unrealities.talkietrivia"
}

// 2. Security Logic - Select specific Google Service files per environment
// You need to rename your existing files to match these paths!
const getGoogleServicesFileAndroid = () => {
  return IS_DEV ? "./google-services-dev.json" : "./google-services-prod.json"
}

const getGoogleServicesFileIOS = () => {
  return IS_DEV
    ? "./GoogleService-Info-Dev.plist"
    : "./GoogleService-Info-Prod.plist"
}

// 3. Environment Variable Logic
// Maps specific EAS Secrets to the internal keys based on variant
const firebaseConfig = {
  apiKey: IS_DEV
    ? process.env.FIREBASE_APIKEY_DEV
    : process.env.FIREBASE_APIKEY,
  appId: IS_DEV ? process.env.FIREBASE_APPID_DEV : process.env.FIREBASE_APPID,
  measurementId: IS_DEV
    ? process.env.FIREBASE_MEASUREMENTID_DEV
    : process.env.FIREBASE_MEASUREMENTID,
  messagingSenderId: IS_DEV
    ? process.env.FIREBASE_MESSAGING_SENDERID_DEV
    : process.env.FIREBASE_MESSAGING_SENDERID,
  projectId: IS_DEV
    ? process.env.FIREBASE_PROJECTID_DEV
    : process.env.FIREBASE_PROJECTID,
}

module.exports = ({ config }) => ({
  ...config,
  name: getAppName(),
  slug: "talkie-trivia",
  scheme: IS_DEV ? "talkie-trivia-dev" : "talkie-trivia",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
    dark: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#121212",
    },
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["assets/**/*"],
  plugins: [
    "@react-native-google-signin/google-signin",
    "expo-font",
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          podfileProperties: {
            "use_modular_headers!": "true",
          },
          newArchEnabled: true,
        },
        android: {
          newArchEnabled: true,
        },
      },
    ],
    // Only enable Sentry for Production/Preview to save quota
    !IS_DEV
      ? [
          "@sentry/react-native/expo",
          {
            url: "https://sentry.io/",
            project: "talkie-trivia",
            organization: "tom-szymanski",
          },
        ]
      : null,
  ].filter(Boolean), // Filter out null plugins
  ios: {
    bundleIdentifier: getBundleIdentifier(),
    googleServicesFile: getGoogleServicesFileIOS(),
    supportsTablet: true,
    userInterfaceStyle: "automatic",
  },
  android: {
    package: getBundleIdentifier(),
    googleServicesFile: getGoogleServicesFileAndroid(),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
    },
    userInterfaceStyle: "automatic",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    eas: {
      projectId: "f8249bd1-1713-4519-8dce-d340e2f6e746",
    },
    router: {
      origin: false,
      root: "src/app",
    },
    // Flags
    isE2E: process.env.IS_E2E === "true",

    // Dynamic Firebase Keys
    firebaseApiKey: firebaseConfig.apiKey,
    firebaseAppId: firebaseConfig.appId,
    firebaseMeasurementId: firebaseConfig.measurementId,
    firebaseMessagingSenderId: firebaseConfig.messagingSenderId,
    firebaseProjectId: firebaseConfig.projectId,

    // Services (Shared or Split depending on your preference, usually shared for TMDB)
    themoviedbKey: process.env.THEMOVIEDB_APIKEY,

    // OAuth Client IDs (These must match the specific Firebase project's Authorized Clients)
    expoClientId: IS_DEV
      ? process.env.CLIENTID_EXPO_DEV
      : process.env.CLIENTID_EXPO,
    iosClientId: IS_DEV
      ? process.env.CLIENTID_IOS_DEV
      : process.env.CLIENTID_IOS,
    webClientId: IS_DEV
      ? process.env.CLIENTID_WEB_DEV
      : process.env.CLIENTID_WEB,
    androidClientId: IS_DEV
      ? process.env.CLIENTID_ANDROID_DEV
      : process.env.CLIENTID_ANDROID,
  },
})
