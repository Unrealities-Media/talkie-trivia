import React, { memo, useMemo } from "react"
import { View, Platform, ViewStyle, TextStyle } from "react-native"
import CustomLoadingIndicator from "./customLoadingIndicator"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import Constants from "expo-constants"
import { DEVICE_CONFIG } from "../config/constants"

interface LoadingIndicatorProps {
  message?: string
}

const useDeviceCheck = () => {
  return useMemo(() => {
    if (Platform.OS === "web") return false

    const deviceYearClass = Constants.deviceYearClass
    const threshold = DEVICE_CONFIG.LOW_END_DEVICE_THRESHOLD_YEAR

    if (deviceYearClass === null || typeof deviceYearClass === "undefined")
      return false

    const requiredClass = threshold - 2011
    return deviceYearClass < requiredClass
  }, [])
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = memo(
  ({ message }) => {
    const styles = useStyles(themedStyles)
    const isLowEndDevice = useDeviceCheck()

    return (
      <View
        style={styles.loadingContainer}
        testID="loading-indicator-container"
      >
        <CustomLoadingIndicator isLowEndDevice={isLowEndDevice} />
        {message && (
          <Typography accessibilityLiveRegion="polite" style={styles.messageText}>{message}</Typography>
        )}
      </View>
    )
  }
)

interface LoadingIndicatorStyles {
  loadingContainer: ViewStyle
  messageText: TextStyle
}

const themedStyles = (theme: Theme): LoadingIndicatorStyles => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    width: "100%",
  },
  messageText: {
    marginTop: theme.spacing.large,
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
})

export default LoadingIndicator
