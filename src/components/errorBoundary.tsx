import React, { Component, ErrorInfo, ReactNode } from "react"
import { View, Text, Button, StyleSheet, Platform, Alert } from "react-native"
import { reloadAppAsync } from "expo"
import { analyticsService } from "../utils/analyticsService"

const safeStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212", // Safe dark background
    padding: 20,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF", // Safe white text
    textAlign: "center",
    marginBottom: 20,
  },
  messageText: {
    fontSize: 16,
    color: "#A0A0A0", // Safe gray text
    textAlign: "center",
    marginBottom: 30,
  },
  errorDetails: {
    marginTop: 30,
    fontSize: 12,
    color: "#757575",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    paddingHorizontal: 10,
  },
})

const ErrorDisplay = ({
  error,
  onReload,
  isReloading,
}: {
  error: Error | null
  onReload: () => void
  isReloading: boolean
}) => {
  return (
    <View style={safeStyles.errorContainer}>
      <Text style={safeStyles.titleText}>Oops! Something went wrong.</Text>
      <Text style={safeStyles.messageText}>
        An unexpected error occurred. Please try reloading the app.
      </Text>
      <Button
        title={isReloading ? "Reloading…" : "Reload App"}
        onPress={onReload}
        disabled={isReloading}
        accessibilityState={{ busy: isReloading, disabled: isReloading }}
        color="#FFC107" // Safe primary color
        testID="reload-button"
      />
      {__DEV__ && (
        <Text style={safeStyles.errorDetails}>
          {error?.message}
          {"\n\n"}
          {error?.stack}
        </Text>
      )}
    </View>
  )
}

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isReloading: boolean
}

class ErrorBoundary extends Component<Props, State> {
  private reloadPending = false
  private mounted = false
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isReloading: false,
  }

  public static getDerivedStateFromError(
    error: Error
  ): Pick<State, "hasError" | "error"> {
    return { hasError: true, error }
  }

  public componentDidMount() {
    this.mounted = true
  }

  public componentWillUnmount() {
    this.mounted = false
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) console.error("ErrorBoundary details:", error, errorInfo)
    analyticsService.trackErrorBoundary(error.message)
    this.setState({ errorInfo })
  }

  private handleReload = async () => {
    if (this.reloadPending) return
    this.reloadPending = true
    this.setState({ isReloading: true })
    try {
      if (Platform.OS === "web") {
        window.location.reload()
        return
      }

      // Reload the installed bundle even when OTA updates are disabled.
      // Keep the button busy after acknowledgment until the runtime restarts.
      await reloadAppAsync("error-boundary")
    } catch (e) {
      this.reloadPending = false
      if (!this.mounted) return
      this.setState({ isReloading: false })
      if (__DEV__) console.error("Failed to reload the app:", e)
      Alert.alert(
        "Reload Failed",
        "Could not automatically reload the app. Please close and restart it manually."
      )
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay error={this.state.error} onReload={this.handleReload} isReloading={this.state.isReloading} />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
