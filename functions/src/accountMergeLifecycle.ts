import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { performance } from "node:perf_hooks"
import { Auth, UserRecord } from "firebase-admin/auth"
import { DocumentData, FieldValue, Firestore, QueryDocumentSnapshot, Timestamp, Transaction } from "firebase-admin/firestore"
import { CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { warn } from "firebase-functions/logger"
import { authorizeMergeRecovery } from "./accountMergeAuthorization"
import { reserveAccountMerge } from "./accountMergeReservation"
import { processAccountMergePage } from "./accountMergeWorker"
import { initialStats, record } from "./gameEngine"

const leaseMs = 10 * 60_000 // Longer than either callable or scheduled invocation.
const retryBudgetMs = 8 * 60_000 // Leave a minute before the scheduled function's hard timeout.
const retiredRetentionMs = 24 * 60 * 60_000
const validUid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/")
const guest = (owner: UserRecord) => !owner.providerData.length && !owner.email && !owner.phoneNumber
const linked = (owner: UserRecord) => !owner.disabled && owner.providerData.some(provider => ["google.com", "apple.com"].includes(provider.providerId))
const notFound = (error: unknown) => (error as { code?: string })?.code === "auth/user-not-found"
function review(): never {
  throw new HttpsError("failed-precondition", "This account operation needs review before continuing.", { reason: "merge-review-required" })
}
function validJob(job: DocumentData | undefined, sourceUid: string): asserts job is DocumentData {
  if (!job || job.sourceUid !== sourceUid || !validUid(job.targetUid) || job.targetUid === sourceUid || job.policyVersion !== 1 ||
    typeof job.operationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(job.operationId) ||
    !["pending", "complete", "cancelled"].includes(job.status) ||
    !Number.isSafeInteger(job.imported) || job.imported < 0 || !Number.isSafeInteger(job.conflicts) || job.conflicts < 0) review()
}
export interface MergeStatus {
  status: "none" | "pending" | "review" | "complete" | "cancelled"
  jobId?: string
  targetUid?: string
  operationId?: string
  imported?: number
  conflicts?: number
  stage?: "validating" | "copying" | "finalizing"
}
function summary(job: DocumentData | undefined): MergeStatus {
  if (!job) return { status: "none" }
  return { status: job.status === "pending" && job.error ? "review" : job.status,
    jobId: job.sourceUid, targetUid: job.targetUid, operationId: job.operationId, imported: job.imported, conflicts: job.conflicts,
    ...(job.status === "pending" ? { stage: job.phase === "copied" ? "finalizing" as const : job.phase === "copy" ? "copying" as const : "validating" as const } : {}),
  }
}

/** Shared orchestration for callable recovery and bounded workers. Creation is rollout-gated. */
export function accountMergeLifecycle(db: Firestore, auth: Auth, monotonicNow: () => number = () => performance.now()) {
  const ref = (uid: string) => db.doc(`accountMerges/${uid}`)
  async function guards(tx: Transaction, job: DocumentData, sourceUid: string): Promise<void> {
    validJob(job, sourceUid)
    const [source, target, sourceDeletion, targetDeletion] = await Promise.all([
      tx.get(db.doc(`accountMergeLocks/${sourceUid}`)), tx.get(db.doc(`accountMergeLocks/${job.targetUid}`)),
      tx.get(db.doc(`accountDeletions/${sourceUid}`)), tx.get(db.doc(`accountDeletions/${job.targetUid}`)),
    ])
    if (source.data()?.jobId !== sourceUid || source.data()?.role !== "source" ||
      target.data()?.jobId !== sourceUid || target.data()?.role !== "target" || sourceDeletion.exists || targetDeletion.exists) review()
  }
  async function read(sourceUid: string): Promise<DocumentData | undefined> {
    const job = (await ref(sourceUid).get()).data()
    if (job) validJob(job, sourceUid)
    return job
  }
  async function begin(request: CallableRequest): Promise<MergeStatus> {
    const { sourceUid } = await reserveAccountMerge(db, auth, request)
    return summary(await read(sourceUid))
  }
  async function ownedJob(request: CallableRequest, mutation = false) {
    const uid = await authorizeMergeRecovery(auth, request)
    const data = record(request.data, ["jobId", "operationId"])
    if (data.jobId !== undefined && !validUid(data.jobId)) throw new HttpsError("invalid-argument", "Invalid account operation.")
    if ((mutation || data.operationId !== undefined) && (typeof data.operationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.operationId))) {
      throw new HttpsError("invalid-argument", "Specify the confirmed account operation.")
    }
    const jobId = data.jobId ?? (await db.doc(`accountMergeLocks/${uid}`).get()).data()?.jobId
    if (!jobId) return { uid, job: undefined }
    if (!validUid(jobId)) review()
    const job = await read(jobId)
    // Missing and unrelated IDs have identical results, without leaking owners.
    if (!job || (uid !== job.sourceUid && uid !== job.targetUid) || (data.operationId !== undefined && data.operationId !== job.operationId)) return { uid, job: undefined }
    return { uid, job }
  }
  async function status(request: CallableRequest): Promise<MergeStatus> {
    return summary((await ownedJob(request)).job)
  }
  async function cancelUnaccepted(request: CallableRequest): Promise<MergeStatus> {
    const uid = await authorizeMergeRecovery(auth, request)
    const data = record(request.data, ["jobId", "operationId", "targetUid", "previousOperationId"])
    if (data.jobId !== uid || !validUid(data.targetUid) || data.targetUid === uid ||
      typeof data.operationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.operationId) ||
      (data.previousOperationId !== undefined && (typeof data.previousOperationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.previousOperationId)))) {
      throw new HttpsError("invalid-argument", "Cancel the original guest's confirmed request.")
    }
    const result = await db.runTransaction(async tx => {
      const [saved, lock, deletion] = await Promise.all([tx.get(ref(uid)), tx.get(db.doc(`accountMergeLocks/${uid}`)), tx.get(db.doc(`accountDeletions/${uid}`))])
      const existing = saved.data()
      if (existing) {
        validJob(existing, uid)
        if (existing.operationId === data.operationId) {
          if (existing.targetUid !== data.targetUid) review()
          return summary(existing) // If accepted meanwhile, use the ordinary lease/copy guards below.
        }
        if (existing.status !== "cancelled" || existing.operationId !== data.previousOperationId) {
          throw new HttpsError("failed-precondition", "Another account operation must be recovered first.")
        }
      }
      if (lock.exists || deletion.exists) review()
      // No ownership of the destination is asserted: this only withdraws this
      // authenticated source's consent, and never locks or changes that account.
      // The same transaction barrier makes an in-flight begin observe cancellation.
      const now = Timestamp.now()
      const cancelled = { sourceUid: uid, targetUid: data.targetUid, operationId: data.operationId, policyVersion: 1,
        status: "cancelled", imported: 0, conflicts: 0, completedAt: now, purgeAt: Timestamp.fromMillis(Date.now() + retiredRetentionMs) }
      tx.set(ref(uid), cancelled)
      return summary(cancelled)
    })
    if (result.status !== "pending" && result.status !== "review") return result
    return cancel({ ...request, data: { jobId: uid, operationId: data.operationId } })
  }
  async function cancel(request: CallableRequest): Promise<MergeStatus> {
    if (request.data?.targetUid !== undefined) return cancelUnaccepted(request)
    const { job } = await ownedJob(request, true)
    if (!job) return { status: "none" }
    return db.runTransaction(async tx => {
      const current = (await tx.get(ref(job.sourceUid))).data()
      validJob(current, job.sourceUid)
      if (current.operationId !== job.operationId) return { status: "none" }
      if (current.status !== "pending") return summary(current)
      await guards(tx, current, job.sourceUid)
      // Validation only changes checkpoints. Once disabling starts, recovery must
      // finish the accepted merge; cancellation must never partially roll it back.
      if (current.freeze || current.imported || current.conflicts || current.phase === "copied" || current.retirement ||
        (current.lease && current.nextAttemptAt?.toMillis() > Date.now())) {
        throw new HttpsError("failed-precondition", "This merge is already processing. Continue account recovery.")
      }
      tx.set(ref(job.sourceUid), { sourceUid: current.sourceUid, targetUid: current.targetUid, policyVersion: 1, operationId: current.operationId,
        status: "cancelled", imported: 0, conflicts: 0, completedAt: Timestamp.now(), purgeAt: Timestamp.fromMillis(Date.now() + retiredRetentionMs) })
      tx.delete(db.doc(`accountMergeLocks/${current.sourceUid}`))
      tx.delete(db.doc(`accountMergeLocks/${current.targetUid}`))
      return summary({ ...current, status: "cancelled" })
    })
  }
  async function process(sourceUid: string): Promise<MergeStatus> {
    if (!validUid(sourceUid)) review()
    const lease = randomUUID()
    const claimed = await db.runTransaction(async tx => {
      const current = (await tx.get(ref(sourceUid))).data()
      if (!current) return false
      validJob(current, sourceUid)
      if (current.status !== "pending" || current.error ||
        (current.lease && current.nextAttemptAt?.toMillis() > Date.now())) return false
      await guards(tx, current, sourceUid)
      tx.update(ref(sourceUid), { lease, nextAttemptAt: Timestamp.fromMillis(Date.now() + leaseMs), updatedAt: Timestamp.now() })
      return true
    })
    if (!claimed) return summary(await read(sourceUid))
    const checkpoint = async (changes: DocumentData) => db.runTransaction(async tx => {
      const job = (await tx.get(ref(sourceUid))).data()
      validJob(job, sourceUid)
      if (job.status !== "pending" || job.lease !== lease) throw new HttpsError("aborted", "Another worker is processing this account operation.")
      await guards(tx, job, sourceUid)
      tx.update(ref(sourceUid), { ...changes, updatedAt: Timestamp.now() })
    })
    try {
      let job = (await read(sourceUid))!
      const target = await auth.getUser(job.targetUid)
      if (!linked(target)) review()
      let source: UserRecord | undefined
      try { source = await auth.getUser(sourceUid) } catch (error) {
        if (!notFound(error) || job.retirement !== "requested" || job.phase !== "copied") throw error
      }
      if (source && (!guest(source) || (source.disabled && !job.freeze))) review()
      if (!source && job.retirement !== "requested") review()
      if (job.phase === "copy" && job.freeze !== "frozen") {
        await checkpoint({ freeze: "requested" })
        // The lock already blocks old game tokens. Disabling/revocation also
        // prevents linking/refresh while guest identity cleanup is in progress.
        await auth.updateUser(sourceUid, { disabled: true })
        const frozen = await auth.getUser(sourceUid)
        if (!guest(frozen) || !frozen.disabled) review()
        await auth.revokeRefreshTokens(sourceUid)
        await checkpoint({ freeze: "frozen" })
        job = (await read(sourceUid))!
        source = frozen
      }
      if (job.freeze === "frozen" && source && !source.disabled) review()
      if (job.phase !== "copied") {
        await processAccountMergePage(db, sourceUid)
        await checkpoint({ lease: FieldValue.delete(), nextAttemptAt: Timestamp.now() })
        return summary(await read(sourceUid))
      }
      if (job.freeze !== "frozen") review()
      // Verify the final copy checkpoint before destroying anything. Source
      // deletion is never used as an implicit signal that copying succeeded.
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref(sourceUid))).data()
        validJob(current, sourceUid)
        await guards(tx, current, sourceUid)
        const stats = await tx.get(db.doc(`players/${current.targetUid}/privateStats/summary`))
        if (current.lease !== lease || current.status !== "pending" || current.phase !== "copied" ||
          current.freeze !== "frozen" || !Number.isSafeInteger(current.sourceGameCount) ||
          current.imported + current.conflicts !== current.sourceGameCount ||
          !isDeepStrictEqual(stats.data() ?? initialStats(current.targetUid), current.copyStats)) review()
        tx.update(ref(sourceUid), { retirement: "requested", updatedAt: Timestamp.now() })
      })
      try { await auth.deleteUser(sourceUid) } catch (error) { if (!notFound(error)) throw error }
      await db.recursiveDelete(db.doc(`players/${sourceUid}`))
      await db.doc(`accountDeletionReceipts/${sourceUid}`).delete()
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref(sourceUid))).data()
        validJob(current, sourceUid)
        if (current.status === "complete") return
        if (current.lease !== lease || current.retirement !== "requested") review()
        await guards(tx, current, sourceUid)
        const now = Timestamp.now()
        tx.set(ref(sourceUid), { sourceUid, targetUid: current.targetUid, operationId: current.operationId, policyVersion: 1, status: "complete",
          imported: current.imported, conflicts: current.conflicts, completedAt: now })
        // Old ID tokens may survive Auth deletion. Retain only this security
        // tombstone for 24 hours, with no destination identifier or job linkage.
        tx.set(db.doc(`accountMergeLocks/${sourceUid}`), { role: "retired", purgeAt: Timestamp.fromMillis(Date.now() + retiredRetentionMs) })
        tx.delete(db.doc(`accountMergeLocks/${current.targetUid}`))
      })
    } catch (error) {
      const requiresReview = (error as { code?: string })?.code === "failed-precondition" || notFound(error)
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref(sourceUid))).data()
        if (current?.status !== "pending" || current.lease !== lease) return
        tx.update(ref(sourceUid), { lease: FieldValue.delete(), updatedAt: Timestamp.now(),
          ...(requiresReview ? { error: "merge-review-required", nextAttemptAt: FieldValue.delete() } : { nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) }) })
      })
      warn(requiresReview ? "account_merge_review_required" : "account_merge_retry_required")
    }
    return summary(await read(sourceUid))
  }
  async function resume(request: CallableRequest): Promise<MergeStatus> {
    const { uid, job } = await ownedJob(request, true)
    if (!job) return { status: "none" }
    if (uid !== job.targetUid) throw new HttpsError("failed-precondition", "Sign in to the saved profile to continue this merge.")
    if (job.status !== "pending") return summary(job)
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref(job.sourceUid))).data()
      validJob(current, job.sourceUid)
      if (current.operationId !== job.operationId) return
      if (current.status !== "pending" || (current.lease && current.nextAttemptAt?.toMillis() > Date.now())) return
      await guards(tx, current, job.sourceUid)
      tx.update(ref(job.sourceUid), { error: FieldValue.delete(), nextAttemptAt: Timestamp.now() })
    })
    return advance(job.sourceUid, job.operationId)
  }
  async function advance(sourceUid: string, operationId: string, hasTime: () => boolean = () => true): Promise<MergeStatus> {
    for (let page = 0; page < 8 && hasTime(); page++) {
      const current = await read(sourceUid)
      if (!current || current.operationId !== operationId) return { status: "none" }
      if (current.status !== "pending" || current.error || current.nextAttemptAt?.toMillis() > Date.now()) return summary(current)
      if (!hasTime()) return summary(current)
      await process(sourceUid)
    }
    return summary(await read(sourceUid))
  }
  async function retry(): Promise<void> {
    const deadline = monotonicNow() + retryBudgetMs
    const hasTime = () => monotonicNow() < deadline
    // Only repair the queue entry we observed. A callable or another scheduled
    // invocation may have claimed/advanced/replaced it since the query.
    const repairQueue = async (observed: QueryDocumentSnapshot, failure?: unknown) => db.runTransaction(async tx => {
      const snapshot = await tx.get(observed.ref)
      if (!snapshot.exists || !snapshot.updateTime?.isEqual(observed.updateTime)) return
      const current = snapshot.data()!
      if (current.lease && current.nextAttemptAt?.toMillis() > Date.now()) return
      if (current.status !== "pending" || current.error) {
        tx.update(observed.ref, { nextAttemptAt: FieldValue.delete() })
      } else if ((failure as { code?: string })?.code === "failed-precondition") {
        tx.update(observed.ref, { error: "merge-review-required", lease: FieldValue.delete(), nextAttemptAt: FieldValue.delete(), updatedAt: Timestamp.now() })
      } else {
        tx.update(observed.ref, { nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000), updatedAt: Timestamp.now() })
      }
    })
    const purge = async (collection: string, canDelete: (data: DocumentData, id: string) => boolean) => {
      if (!hasTime()) return
      const expired = await db.collection(collection).where("purgeAt", "<=", Timestamp.now()).limit(100).get()
      let needsReview = false
      for (const entry of expired.docs) {
        if (!hasTime()) break
        const invalid = await db.runTransaction(async tx => {
          const current = (await tx.get(entry.ref)).data()
          if (!current || !current.purgeAt || current.purgeAt.toMillis() > Date.now()) return false
          if (canDelete(current, entry.id)) tx.delete(entry.ref)
          else {
            // An invalid expiry marker must not delete a live lock/job or fill
            // every cleanup page forever. Preserve it for operator review.
            tx.update(entry.ref, { purgeAt: FieldValue.delete(), retentionError: "merge-retention-review-required" })
            return true
          }
          return false
        })
        needsReview ||= invalid
      }
      if (needsReview) warn("account_merge_retention_review_required")
    }
    // Retention gets its own bounded pass before processing jobs, so a busy
    // recovery backlog cannot indefinitely postpone expired-marker cleanup.
    await purge("accountMergeLocks", data => data.role === "retired" && Object.keys(data).every(key => ["role", "purgeAt"].includes(key)))
    await purge("accountMerges", (data, id) => {
      try { validJob(data, id) } catch { return false }
      return data.status === "cancelled" && data.imported === 0 && data.conflicts === 0
    })
    if (!hasTime()) { warn("account_merge_retry_budget_reached"); return }
    const due = await db.collection("accountMerges").where("nextAttemptAt", "<=", Timestamp.now()).orderBy("nextAttemptAt").limit(20).get()
    for (const job of due.docs) {
      if (!hasTime()) break
      try {
        if (job.data().status !== "pending" || job.data().error) await repairQueue(job)
        else await advance(job.id, job.data().operationId, hasTime)
      } catch (error) {
        await repairQueue(job, error)
        warn((error as { code?: string })?.code === "failed-precondition" ? "account_merge_review_required" : "account_merge_retry_required")
      }
    }
    if (!hasTime()) warn("account_merge_retry_budget_reached")
  }
  return { begin, status, cancel, process, resume, retry }
}
