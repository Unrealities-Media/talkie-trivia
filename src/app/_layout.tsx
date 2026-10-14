import React from "react"
import { Slot } from "expo-router"
import ErrorBoundary from "../components/errorBoundary"
import { NetworkProvider, useNetwork } from "../contexts/networkContext"
import { AuthProvider, useAuth } from "../contexts/authContext"
import { ThemeProvider } from "../contexts/themeContext"
import { useDailyChallenge } from "../utils/hooks/useDailyChallenge"
import { useNotifications } from "../utils/hooks/useNotifications"
import * as Sentry from "@sentry/react-native"

Sentry.init({
  dsn: "https://c7d927fefd9e0c239fcfef81c1df5def@o4510630361300992.ingest.us.sentry.io/4510630399901696",
  // Keep remote diagnostics off until disclosure, retention, and consent are verified.
  enabled: false,
  enableNative: false,
  autoInitializeNativeSdk: false,
  sendDefaultPii: false,
  debug: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  spotlight: false,
})

function RootLayoutNav() {
  const { player, loading, deletion } = useAuth()
  const { isNetworkConnected } = useNetwork()
  useDailyChallenge(player, isNetworkConnected)
  useNotifications(loading || !!deletion)
  // Daily-game failures belong to the Game screen. Settings remain reachable.
  return <Slot />
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NetworkProvider>
          <AuthProvider><RootLayoutNav /></AuthProvider>
        </NetworkProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default Sentry.wrap(RootLayout)
