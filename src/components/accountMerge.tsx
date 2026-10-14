import React from "react"
import { View } from "react-native"
import { useAuth } from "../contexts/authContext"
import { Typography } from "./ui/typography"
import { Button } from "./ui/button"

export default function AccountMerge() {
  const { merge, mergeProposal, mergeError, isMerging, isSigningIn, confirmMerge, continueMerge, cancelMerge, finishMerge } = useAuth()
  if (!merge && !mergeProposal) return null
  const busy = isMerging || isSigningIn
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", padding: 24, gap: 12 }}>
    <Typography variant="h2" accessibilityRole="header">{mergeProposal ? "Combine your progress?" : merge?.status === "complete" ? "Your progress is combined" : "Combining accounts"}</Typography>
    {mergeProposal && <>
      <Typography>Connect this guest to {mergeProposal.accountLabel}.</Typography>
      <Typography>Guest games from other days will be added to your saved account. If both accounts played the same day, the saved account's game and score stay. The guest game will be kept separately without extra points.</Typography>
      <Typography>After completion, this guest account will be retired and you'll play with your saved account. Once copying starts, this cannot be undone.</Typography>
      <Button title="Combine progress" onPress={confirmMerge} disabled={busy} />
      <Button title="Keep playing as guest" onPress={cancelMerge} disabled={busy} variant="secondary" />
    </>}
    {merge && <>
      <Typography accessibilityLiveRegion="polite">{merge.status === "complete"
        ? `${merge.imported ?? 0} guest games added. ${merge.conflicts ?? 0} same-day guest games preserved separately. Your saved account's same-day scores were kept.`
        : merge.status === "cancelled" ? "The merge was cancelled before copying. Both accounts kept their progress."
        : merge.status === "review" ? "We couldn't safely combine these accounts. Your saved request is kept. Retry recovery; if it still cannot continue, contact support with the reference below."
        : merge.status === "submitting" ? "We are checking whether your request was accepted. Keep this saved request and retry; starting a new guest could separate you from your progress."
        : "Your accounts are temporarily unavailable for play while progress is combined. You can close the app and recover this request by verifying the same saved Google account."}</Typography>
      {merge.status !== "complete" && <Typography>Recovery reference: {merge.operationId}</Typography>}
      {merge.status === "complete"
        ? <Button title="Open saved account" onPress={finishMerge} disabled={busy} />
        : merge.status === "cancelled"
        ? <Button title="Return to account" onPress={cancelMerge} disabled={busy} />
        : <Button title={busy ? "Working…" : "Verify account and continue"} onPress={continueMerge} disabled={busy} />}
      {(merge.status === "submitting" || merge.status === "pending" || merge.status === "review") && <>
        <Button title="Cancel if copying hasn't started" onPress={cancelMerge} disabled={busy} variant="secondary" />
        <Typography>Cancellation is available only before processing starts. Otherwise, continue recovery to finish combining your progress.</Typography>
      </>}
    </>}
    {mergeError && <Typography accessibilityRole="alert" accessibilityLiveRegion="polite">{mergeError}</Typography>}
  </View>
}
