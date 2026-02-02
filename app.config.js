require("dotenv").config()

const myValue = "talkie-trivia"

module.exports = ({ config }) => ({
  ...config,
  scheme: "talkie-trivia",
  expo: {
    name: myValue,
    slug: "talkie-trivia",
    scheme: "talkie-trivia",
    version: process.env.MY_CUSTOM_PROJECT_VERSION || "1.0.0",
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
      ["@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "talkie-trivia",
          organization: "tom-szymanski",
        },
      ]
    ],
    ios: {
      bundleIdentifier: "com.unrealities.talkietrivia",
      googleServicesFile: "./GoogleService-Info.plist",
      supportsTablet: true,
      userInterfaceStyle: "automatic",
    },
    android: {
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      package: "com.unrealities.talkietrivia",
      userInterfaceStyle: "automatic",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      "eas": {
        "projectId": "90056e11-69a8-4dbd-8fbd-456746ee09e8"
      },
      router: {
        origin: false,
        root: "src/app",
      },
      isE2E:
        process.env.IS_E2E === "true" ||
        process.env.EXPO_PUBLIC_IS_E2E === "true",
      firebaseApiKey: process.env.FIREBASE_APIKEY,
      firebaseAppId: process.env.FIREBASE_APPID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENTID,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDERID,
      firebaseProjectId: process.env.FIREBASE_PROJECTID,
      themoviedbKey: process.env.THEMOVIEDB_APIKEY,
      expoClientId: process.env.CLIENTID_EXPO,
      iosClientId: process.env.CLIENTID_IOS,
      webClientId: process.env.CLIENTID_WEB,
      androidClientId: process.env.CLIENTID_ANDROID,
    },
  },
})
