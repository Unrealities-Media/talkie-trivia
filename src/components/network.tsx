import React, { memo } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"

interface NetworkContainerProps {
  isConnected: boolean
}

const NetworkContainer = memo(({ isConnected }: NetworkContainerProps) => {
  const styles = useStyles(themedStyles)

  if (isConnected) {
    return null // Don't render anything when connected
  }

  return (
    <View style={styles.containerNotConnected}>
      <Typography style={styles.notConnectedText}>
        Network is not connected
      </Typography>
    </View>
  )
})

interface NetworkStyles {
  containerNotConnected: ViewStyle
  notConnectedText: TextStyle
}

const themedStyles = (theme: Theme): NetworkStyles => ({
  containerNotConnected: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.small,
    paddingHorizontal: theme.spacing.medium,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: theme.responsive.platform === "ios" ? 50 : 20,
    left: theme.spacing.medium,
    right: theme.spacing.medium,
    borderRadius: theme.responsive.scale(8),
    ...theme.shadows.medium,
    zIndex: 9999,
  },
  notConnectedText: {
    ...theme.typography.button,
    color: theme.colors.onError,
    fontSize: theme.responsive.responsiveFontSize(14),
  },
})

export default NetworkContainer
