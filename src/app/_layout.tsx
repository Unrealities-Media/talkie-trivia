import React from "react"
import { Slot } from "expo-router"
import Head from "expo-router/head"
import ErrorBoundary from "../components/errorBoundary"
import { NetworkProvider, useNetwork } from "../contexts/networkContext"
import { AuthProvider, useAuth } from "../contexts/authContext"
import { ThemeProvider } from "../contexts/themeContext"
import { useDailyChallenge } from "../utils/hooks/useDailyChallenge"
import { useNotifications } from "../utils/hooks/useNotifications"

// Remote crash collection is disabled for this beta. Do not import its SDK
// into startup while no diagnostics are collected; ErrorBoundary stays local.

function RootLayoutNav() {
  const { player, loading, deletion } = useAuth()
  const { isNetworkConnected } = useNetwork()
  useDailyChallenge(player, isNetworkConnected)
  useNotifications(loading || !!deletion)
  // Daily-game failures belong to the Game screen. Settings remain reachable.
  return <><Head><title>Talkie Trivia</title></Head><Slot /></>
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

export default RootLayout
