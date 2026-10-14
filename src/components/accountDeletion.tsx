import React, { useState } from "react"
import { View } from "react-native"
import { useAuth } from "../contexts/authContext"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"
import ConfirmationModal from "./confirmationModal"

export default function AccountDeletion() {
  const { user, deletion, merge, mergeProposal, deletionError, isDeleting, isSigningIn, handleDeleteAccount, refreshDeletion, startNewGuest } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const busy = isDeleting || isSigningIn
  if (merge || mergeProposal) return null
  if (!user && !deletion) return null
  const status = deletion?.status
  return <View style={{ width: "100%", gap: 12 }}>
    {deletion ? <>
      <Typography variant="h2" accessibilityRole="header">{status === "complete" ? "Account deleted" : "Account deletion"}</Typography>
      <Typography accessibilityLiveRegion="polite">
        {status === "complete" ? "Your account, saved games, statistics and history have been deleted. You can choose to start again as a new guest."
          : status === "pending" ? "Your deletion request was accepted. Cleanup is still in progress and will continue even if you close the app. Check here for confirmation."
          : status === "unknown" ? "This receipt can no longer confirm the deletion status. We have not assumed that deletion completed. Keep this app installed while resolving the request."
          : "Your deletion request has not been confirmed. Check its status before retrying. If verification is needed, use the same Google account."}
      </Typography>
      {status === "complete" ? <Button title="Start again as a new guest" onPress={startNewGuest} isLoading={busy} />
        : <Button title="Check deletion status" onPress={refreshDeletion} isLoading={busy} />}
      {(status === "prepared" || status === "submitting") && <Button title="Verify and retry deletion" onPress={handleDeleteAccount} disabled={busy} variant="secondary" />}
    </> : <>
      <Typography>Delete this account and its saved games, statistics and history permanently, including guest progress.</Typography>
      <Button title="Delete account and data" onPress={() => setConfirming(true)} disabled={busy} variant="secondary" accessibilityHint="Opens a confirmation before permanently deleting this account" />
    </>}
    {deletionError && <Typography variant="error" accessibilityRole="alert">{deletionError}</Typography>}
    <ConfirmationModal isVisible={confirming} title="Delete your account?"
      message="This permanently deletes your account, saved games, statistics and history. Pending moves will also be removed. This cannot be undone. A minimal deletion receipt is kept for up to 30 days so you can confirm the result. Linked accounts must verify their sign-in."
      confirmText="Permanently delete" cancelText="Keep my account"
      onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); void handleDeleteAccount() }} />
  </View>
}
