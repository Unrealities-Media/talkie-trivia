import { updateCurrentUser } from "firebase/auth"
import { Functions, getFunctions, httpsCallable } from "firebase/functions"
import uuid from "react-native-uuid"
import { app, auth } from "./firebaseClient"
import { mergeStorage, MergeReceipt } from "./mergeStorage"
import { MergeIdentity } from "./mergeIdentity"
import { deletionStorage } from "./deletionStorage"
import { gameService } from "./gameService"
import { sessionStorage } from "./sessionStorage"
import { withSessionRefresh } from "./sessionRefresh"

interface Status {
  status: "none" | "pending" | "review" | "complete" | "cancelled"
  jobId?: string
  targetUid?: string
  operationId?: string
  imported?: number
  conflicts?: number
}
async function call(functions: Functions, name: string, payload: unknown): Promise<Status> {
  const { data } = await httpsCallable<unknown, Status>(functions, name, { timeout: 135000 })(payload)
  if (!data || !["none", "pending", "review", "complete", "cancelled"].includes(data.status)) throw new Error("Invalid account operation response.")
  return data
}
function source(uid: string) {
  if (auth.currentUser?.uid !== uid || !auth.currentUser.isAnonymous) throw new Error("Reopen the original guest before combining progress.")
}
async function current(receipt: MergeReceipt) {
  if ((await mergeStorage.read())?.operationId !== receipt.operationId) throw new Error("The account operation changed.")
  if (await deletionStorage.read()) throw new Error("Finish account deletion first.")
  if (auth.currentUser && ![receipt.sourceUid, receipt.targetUid].includes(auth.currentUser.uid)) throw new Error("Your signed-in account changed.")
}
function target(receipt: MergeReceipt, identity: MergeIdentity) {
  if (identity.user.uid !== receipt.targetUid || identity.user.isAnonymous) throw new Error("Verify the same saved account to continue.")
}
async function accept(receipt: MergeReceipt, status: Status) {
  await current(receipt)
  if (status.status === "none") throw Object.assign(new Error("No accepted operation was found. Retry the original request from your guest session."), { code: "merge/not-found" })
  if (status.jobId !== receipt.sourceUid || status.targetUid !== receipt.targetUid || status.operationId !== receipt.operationId ||
    !Number.isSafeInteger(status.imported) || status.imported! < 0 || !Number.isSafeInteger(status.conflicts) || status.conflicts! < 0) {
    throw new Error("The account operation response did not match your confirmation.")
  }
  const next = { ...receipt, status: status.status, imported: status.imported, conflicts: status.conflicts }
  await mergeStorage.write(next)
  return next
}
const operation = (receipt: MergeReceipt) => ({ jobId: receipt.sourceUid, operationId: receipt.operationId })

export const accountMergeService = {
  async discover(uid: string): Promise<MergeReceipt | null> {
    const user = auth.currentUser
    if (!user || user.uid !== uid) throw new Error("Your signed-in account changed.")
    const status = await withSessionRefresh(user, () => auth.currentUser === user,
      () => call(getFunctions(app), "getAccountMergeStatus", {}))
    if (auth.currentUser !== user) throw new Error("Your signed-in account changed.")
    if (status.status === "none") return null
    if (!status.jobId || !status.targetUid || !status.operationId || ![status.jobId, status.targetUid].includes(uid)) throw new Error("Invalid account recovery response.")
    const receipt: MergeReceipt = { sourceUid: status.jobId, targetUid: status.targetUid, operationId: status.operationId,
      status: status.status, imported: status.imported, conflicts: status.conflicts }
    await mergeStorage.write(receipt)
    return receipt
  },
  async prepare(sourceUid: string, identity: MergeIdentity): Promise<MergeReceipt> {
    source(sourceUid)
    if (identity.user.uid === sourceUid || identity.user.isAnonymous) throw new Error("Choose a distinct saved account.")
    if (await deletionStorage.read() || await mergeStorage.read()) throw new Error("Finish the current account operation first.")
    await gameService.resumePendingAction(sourceUid)
    source(sourceUid)
    const previous = await call(getFunctions(app), "getAccountMergeStatus", { jobId: sourceUid })
    source(sourceUid)
    if (!["none", "cancelled"].includes(previous.status)) throw new Error("An account operation is already in progress. Reopen account recovery.")
    const receipt: MergeReceipt = { sourceUid, targetUid: identity.user.uid, operationId: String(uuid.v4()), status: "submitting",
      ...(previous.status === "cancelled" ? { previousOperationId: previous.operationId } : {}) }
    // Written before begin: a lost request/response or terminated process stays gated.
    await mergeStorage.write(receipt)
    return receipt
  },
  async submit(receipt: MergeReceipt, identity: MergeIdentity): Promise<MergeReceipt> {
    await current(receipt)
    source(receipt.sourceUid)
    target(receipt, identity)
    const targetIdToken = await identity.user.getIdToken(true)
    await current(receipt)
    source(receipt.sourceUid)
    return accept(receipt, await call(getFunctions(app), "beginAccountMerge", {
      confirmation: "MERGE", targetIdToken, operationId: receipt.operationId,
      ...(receipt.previousOperationId ? { previousOperationId: receipt.previousOperationId } : {}),
    }))
  },
  async refresh(receipt: MergeReceipt, identity?: MergeIdentity): Promise<MergeReceipt> {
    await current(receipt)
    if (identity) target(receipt, identity)
    else if (!auth.currentUser || ![receipt.sourceUid, receipt.targetUid].includes(auth.currentUser.uid)) throw new Error("Verify your saved account to recover this operation.")
    return accept(receipt, await call(identity?.functions ?? getFunctions(app), "getAccountMergeStatus", operation(receipt)))
  },
  async resume(receipt: MergeReceipt, identity: MergeIdentity): Promise<MergeReceipt> {
    await current(receipt)
    target(receipt, identity)
    return accept(receipt, await call(identity.functions, "resumeAccountMerge", operation(receipt)))
  },
  async cancel(receipt: MergeReceipt, identity?: MergeIdentity): Promise<MergeReceipt> {
    await current(receipt)
    if (identity) target(receipt, identity)
    else source(receipt.sourceUid)
    return accept(receipt, await call(identity?.functions ?? getFunctions(app), "cancelAccountMerge", {
      ...operation(receipt),
      ...(!identity && receipt.status === "submitting" ? { targetUid: receipt.targetUid,
        ...(receipt.previousOperationId ? { previousOperationId: receipt.previousOperationId } : {}) } : {}),
    }))
  },
  async finish(receipt: MergeReceipt, identity: MergeIdentity): Promise<void> {
    target(receipt, identity)
    // Revalidate the server result. Local storage is continuity metadata, not authority.
    const verified = await this.refresh(receipt, identity)
    if (verified.status !== "complete") throw new Error("Wait for combining progress to finish.")
    await current(receipt)
    await updateCurrentUser(auth, identity.user)
    if (auth.currentUser?.uid !== receipt.targetUid) throw new Error("Your signed-in account changed.")
    await sessionStorage.write({ uid: receipt.targetUid, isAnonymous: false })
    await gameService.clearLocalProgress(receipt.sourceUid)
    await mergeStorage.clear(receipt.operationId)
  },
  async dismissCancellation(receipt: MergeReceipt, identity?: MergeIdentity): Promise<void> {
    const verified = await this.refresh(receipt, identity)
    if (verified.status !== "cancelled") throw new Error("Cancellation has not been confirmed.")
    await mergeStorage.clear(receipt.operationId)
  },
}
