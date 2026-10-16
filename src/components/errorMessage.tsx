import React, { memo } from "react"
import { View, ViewStyle, TextStyle, GestureResponderEvent } from "react-native"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"
import { u } from "../styles/utils"

interface ErrorMessageProps {
  message: string
  onRetry?: (event: GestureResponderEvent) => void
}

const ErrorMessage: React.FC<ErrorMessageProps> = memo(
  ({ message, onRetry }) => {
    const styles = useStyles(themedStyles)

    return (
      <View style={styles.errorContainer}>
        <Typography variant="error" style={styles.errorText}>
          {message}
        </Typography>
        {onRetry && (
          <Button
            testID="retry"
            title="Retry"
            onPress={onRetry}
            variant="secondary"
            style={u.mtMd}
          />
        )}
      </View>
    )
  }
)

interface ErrorMessageStyles {
  errorContainer: ViewStyle
  errorText: TextStyle
}

const themedStyles = (theme: Theme): ErrorMessageStyles => ({
  errorContainer: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    minHeight: 200,
    marginVertical: theme.spacing.large,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 3,
    padding: theme.spacing.large,
  },
  errorText: {
    ...theme.typography.bodyText,
    color: theme.colors.error,
    fontSize: theme.responsive.responsiveFontSize(18),
    textAlign: "center",
    width: "90%",
  },
})

export default ErrorMessage
