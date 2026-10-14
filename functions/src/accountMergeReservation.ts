import { Auth } from "firebase-admin/auth"
import { Firestore, Timestamp } from "firebase-admin/firestore"
import { CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { authorizeAccountMerge } from "./accountMergeAuthorization"
import { MERGE_POLICY_VERSION } from "./accountMergePolicy"

export interface MergeReservation {
  sourceUid: string
  targetUid: string
  status: "pending" | "cancelled"
  policyVersion: typeof MERGE_POLICY_VERSION
}

/**
 * Durable reservation behind the rollout-gated callable. No source data or Auth
 * identity is removed here; lifecycle processing owns copying and retirement.
 */
export async function reserveAccountMerge(
  db: Firestore, auth: Auth, request: CallableRequest,
): Promise<MergeReservation> {
  const { sourceUid, targetUid, operationId, previousOperationId } = await authorizeAccountMerge(auth, request)
  const reservation: MergeReservation = { sourceUid, targetUid, status: "pending", policyVersion: MERGE_POLICY_VERSION }
  const job = db.doc(`accountMerges/${sourceUid}`)
  const sourceLock = db.doc(`accountMergeLocks/${sourceUid}`)
  const targetLock = db.doc(`accountMergeLocks/${targetUid}`)
  return db.runTransaction(async tx => {
    const [existingJob, sourceBarrier, targetBarrier, sourceDeletion, targetDeletion] = await Promise.all([
      tx.get(job), tx.get(sourceLock), tx.get(targetLock),
      tx.get(db.doc(`accountDeletions/${sourceUid}`)), tx.get(db.doc(`accountDeletions/${targetUid}`)),
    ])
    if (sourceDeletion.exists || targetDeletion.exists) {
      throw new HttpsError("failed-precondition", "An account has a pending deletion request. Complete account recovery before combining progress.")
    }
    // A lost response must not turn a retry of cancelled consent into new work.
    if (existingJob.data()?.operationId === operationId && existingJob.data()?.status === "cancelled") {
      if (existingJob.data()?.targetUid !== targetUid) throw new HttpsError("already-exists", "This confirmation belongs to another account operation.")
      return { ...reservation, status: "cancelled" }
    }
    if (existingJob.exists && existingJob.data()?.status !== "cancelled") {
      const existing = existingJob.data()!
      if (existing.sourceUid !== sourceUid || existing.targetUid !== targetUid || existing.operationId !== operationId) {
        throw new HttpsError("already-exists", "This guest already has an account operation in progress.")
      }
      const source = sourceBarrier.data()
      const target = targetBarrier.data()
      if (existing.status !== "pending" || existing.policyVersion !== MERGE_POLICY_VERSION ||
        source?.jobId !== sourceUid || source?.role !== "source" || target?.jobId !== sourceUid || target?.role !== "target") {
        throw new HttpsError("failed-precondition", "This account operation needs review before continuing.")
      }
      return reservation // Same accepted operation; never reset its counters/cursor.
    }
    if (sourceBarrier.exists || targetBarrier.exists) {
      throw new HttpsError("already-exists", "An account already has an operation in progress. Finish it before combining progress.")
    }
    if (existingJob.exists && (existingJob.data()?.sourceUid !== sourceUid || existingJob.data()?.imported !== 0 || existingJob.data()?.conflicts !== 0)) {
      throw new HttpsError("failed-precondition", "This account operation needs review before continuing.")
    }
    if (existingJob.exists && existingJob.data()?.operationId !== previousOperationId) {
      throw new HttpsError("failed-precondition", "Reopen account confirmation before starting a new merge.")
    }
    const now = Timestamp.now()
    const saved = { ...reservation, operationId, cursor: null, imported: 0, conflicts: 0, startedAt: now, updatedAt: now, nextAttemptAt: now }
    if (existingJob.exists) tx.set(job, saved)
    else tx.create(job, saved)
    tx.create(sourceLock, { jobId: sourceUid, role: "source" })
    tx.create(targetLock, { jobId: sourceUid, role: "target" })
    return reservation
  })
}
