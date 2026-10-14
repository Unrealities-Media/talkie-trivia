import React, { useState } from "react"
import { View } from "react-native"
import { useAuth } from "../contexts/authContext"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"
import ConfirmationModal from "./confirmationModal"
import GoogleLogin from "./googleLogin"
import { isLocalDemoIdentity, linkAndRestoreLocalGuest } from "../services/localDemoIdentity"

export default function SessionRecovery() {
  const { lostSession, loading, isSigningIn, retryAuthentication, replaceLostSession } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  if (!lostSession) return null
  const busy = loading || isSigningIn || restoring
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", padding: 24, gap: 12 }}>
    <Typography variant="h2" accessibilityRole="header">Reopen your account</Typography>
    <Typography accessibilityLiveRegion="polite">
      {lostSession.isAnonymous
        ? "Your previous guest session is no longer available on this device. We haven't started a replacement game. Retry, or sign in if you linked that guest to a Google account."
        : "Your previous sign-in is no longer available on this device. Sign in with the same Google account to reopen your saved progress."}
    </Typography>
    <Button title="Retry session" onPress={retryAuthentication} disabled={busy} />
    {isLocalDemoIdentity() && lostSession.isAnonymous && <>
      <Typography>Local development: emulator restarts invalidate guest tokens. Link this saved guest to a fake demo account to restore its progress.</Typography>
      <Button title="Link and restore local guest" disabled={busy} onPress={() => {
        setRestoring(true); setRestoreError(null)
        void linkAndRestoreLocalGuest(lostSession.uid).catch(error => setRestoreError(error.message)).finally(() => setRestoring(false))
      }} />
      {restoreError && <Typography variant="error">{restoreError}</Typography>}
    </>}
    <GoogleLogin />
    <Button title="Start a new guest instead" onPress={() => setConfirming(true)} disabled={busy} variant="secondary" />
    <ConfirmationModal isVisible={confirming} title="Start a separate guest?"
      message="Your previous guesses, statistics and unsaved moves will not carry over. This does not delete the old account. If you linked it to Google, sign in to that account to recover its saved progress."
      confirmText="Start new guest" cancelText="Keep trying"
      onCancel={() => setConfirming(false)}
      onConfirm={() => { setConfirming(false); void replaceLostSession() }} />
  </View>
}
