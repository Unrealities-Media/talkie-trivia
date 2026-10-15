import React, { memo } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { useAuth } from "../contexts/authContext"
import { hapticsService } from "../utils/hapticsService"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"
import { isLocalDemoIdentity } from "../services/localDemoIdentity"
import ConfirmationModal from "./confirmationModal"

const GoogleLogin: React.FC = memo(() => {
  const { player, user, handleSignIn, handleSignOut, isSigningIn, accountError, existingAccountPending, confirmAccountSwitch, cancelAccountSwitch } =
    useAuth()
  const styles = useStyles(themedStyles)

  const isSignedIn = !!user && !user.isAnonymous
  const displayName = user?.displayName || player?.name || ""

  const buttonText = isSignedIn
    ? `Sign Out ${displayName}`.trim()
    : isLocalDemoIdentity() ? "Sign in to local demo" : "Sign In with Google"
  const accessibilityLabel = isSignedIn
    ? `Sign out ${displayName}`.trim()
    : isLocalDemoIdentity() ? "Sign in to local demo" : "Sign in with Google"
  const accessibilityHint = isSignedIn
    ? "Signs you out of the game"
    : isLocalDemoIdentity() ? "Uses a fake account in the local emulator" : "Signs you in with your Google account"

  const handlePress = () => {
    hapticsService.medium()
    if (isSignedIn) {
      handleSignOut()
    } else {
      handleSignIn()
    }
  }

  return (
    <View style={styles.container}>
      <ConfirmationModal isVisible={!!existingAccountPending && !isSigningIn}
        title="Open your existing account?"
        message="Your Google account already has saved progress. Opening it will leave this guest's games separate; they will not be combined or deleted. This unlinked guest may no longer be recoverable from this browser. Keep playing as guest to stay with this progress."
        confirmText="Open existing account" cancelText="Keep playing as guest"
        onConfirm={() => { void confirmAccountSwitch() }} onCancel={cancelAccountSwitch} />
      <Button
        title={buttonText}
        onPress={handlePress}
        isLoading={isSigningIn}
        variant="secondary"
        style={styles.button}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSigningIn }}
      />
      {accountError && (
        <Typography variant="error" style={styles.errorText}>
          {accountError}
        </Typography>
      )}
    </View>
  )
})

interface GoogleLoginStyles {
  container: ViewStyle
  button: ViewStyle
  errorText: TextStyle
}

const themedStyles = (theme: Theme): GoogleLoginStyles => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: theme.responsive.scale(400),
    alignSelf: "center",
    paddingVertical: theme.spacing.small,
  },
  button: {
    width: "100%",
    maxWidth: theme.responsive.scale(280),
  },
  errorText: {
    marginTop: theme.spacing.small,
    textAlign: "center",
    fontSize: theme.responsive.responsiveFontSize(14),
  },
})

export default GoogleLogin
