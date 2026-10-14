import { getFunctions, httpsCallable } from "firebase/functions"
import { signOut } from "firebase/auth"
import { Platform } from "react-native"
import { app, auth } from "./firebaseClient"
import { gameService } from "./gameService"
import { deletionStorage, DeletionReceipt } from "./deletionStorage"
import { functionsBaseUrl } from "../config/firebaseEnvironment"
import { sessionStorage } from "./sessionStorage"
import { reminderService } from "./reminderService"

// Deliberately omit Auth from status checks: a deleted/disabled session cannot
// refresh its token. The unguessable receipt grants status access only.
async function readStatus(receipt: DeletionReceipt): Promise<DeletionReceipt> {
  const project = app.options.projectId
  if (!project || !/^[a-z0-9-]+$/.test(project)) throw new Error("Account service is not configured.")
  const base = functionsBaseUrl(project)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${base}/getAccountDeletionStatus`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { uid: receipt.uid, secret: receipt.secret } }), signal: controller.signal,
    })
    const body = await response.json()
    if (!response.ok || !["prepared", "pending", "complete", "unknown"].includes(body.result?.status)) throw new Error("Deletion status is unavailable.")
    // Completion already acknowledged to this device never regresses after expiry.
    return { ...receipt, status: receipt.status === "complete" ? "complete" : body.result.status }
  } finally { clearTimeout(timer) }
}

export const accountDeletionService = {
  async prepare(uid: string): Promise<DeletionReceipt> {
    const stored = await deletionStorage.read()
    if (stored) {
      if (stored.uid !== uid) throw new Error("Finish the previous account deletion first.")
      return stored
    }
    if (auth.currentUser?.uid !== uid) throw new Error("Your account changed.")
    const result = await httpsCallable(getFunctions(app), "prepareAccountDeletion")({})
    const secret = (result.data as { secret?: string })?.secret
    if (!secret || !/^[a-f0-9]{64}$/.test(secret) || auth.currentUser?.uid !== uid) throw new Error("The deletion request could not be prepared.")
    const receipt: DeletionReceipt = { uid, secret, status: "prepared" }
    // No irreversible request occurs unless the receipt is durably saved first.
    await deletionStorage.write(receipt)
    return receipt
  },
  async refresh(receipt: DeletionReceipt): Promise<DeletionReceipt> {
    const next = await readStatus(receipt)
    await deletionStorage.write(next)
    return next
  },
  async submit(receipt: DeletionReceipt): Promise<DeletionReceipt> {
    if (auth.currentUser?.uid !== receipt.uid) throw new Error("Verify this account before retrying deletion.")
    const submitting: DeletionReceipt = { ...receipt, status: "submitting" }
    await deletionStorage.write(submitting)
    const result = await httpsCallable(getFunctions(app), "deleteAccount", { timeout: 135000 })({ confirmation: "DELETE", secret: receipt.secret })
    const data = result.data as { accepted?: boolean; complete?: boolean }
    if (data?.accepted !== true || typeof data.complete !== "boolean") throw new Error("Deletion confirmation was not received.")
    const next: DeletionReceipt = { ...receipt, status: data.complete ? "complete" : "pending" }
    await deletionStorage.write(next)
    return next
  },
  async clearLocal(receipt: DeletionReceipt): Promise<void> {
    if (receipt.status !== "pending" && receipt.status !== "complete") return
    await gameService.clearLocalProgress(receipt.uid)
    await sessionStorage.clearFor(receipt.uid)
    if (Platform.OS !== "web") {
      // Clear durable intent so foreground recovery cannot recreate the reminder.
      await reminderService.disable()
      const Notifications: typeof import("expo-notifications") = require("expo-notifications")
      await Notifications.cancelAllScheduledNotificationsAsync()
      await Notifications.dismissAllNotificationsAsync()
    }
    // Never sign out an unrelated account that arrived during an asynchronous call.
    if (auth.currentUser?.uid === receipt.uid) await signOut(auth)
  },
}
