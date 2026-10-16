import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { Auth, UserRecord } from "firebase-admin/auth"
import { DocumentSnapshot, FieldValue, Firestore, getFirestore, Timestamp, Transaction } from "firebase-admin/firestore"
import { initialStats, Stats } from "./gameEngine"
import { summary } from "./statisticsStorage"

type Action = "retry" | "cancel-before-copy"
interface Selection { projectId: string; sourceUid: string; operationId: string; action: Action }
export interface ReconciliationPlan extends Selection {
  schemaVersion: 1
  expiresAt: number
  digest: string
  blockers: string[]
  summary: { targetUid: string; status: string; phase: string; imported: number | null; conflicts: number | null;
    freeze: string | null; retirement: string | null; source: IdentitySummary; target: IdentitySummary }
}
type IdentitySummary = { exists: boolean; disabled?: boolean; providers?: string[] }
const validUid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/")
const validOperation = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value)
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const isGuest = (owner: UserRecord) => !owner.providerData.length && !owner.email && !owner.phoneNumber && !owner.tenantId
const isLinked = (owner: UserRecord) => !owner.tenantId && owner.providerData.some(provider => ["google.com", "apple.com"].includes(provider.providerId))
const identitySummary = (owner: UserRecord | null): IdentitySummary => owner ?
  { exists: true, disabled: owner.disabled, providers: owner.providerData.map(provider => provider.providerId).sort() } : { exists: false }
function canonical(value: any): any {
  if (value instanceof Timestamp) return { seconds: value.seconds, nanoseconds: value.nanoseconds }
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")
const version = (snapshot: DocumentSnapshot) => ({ path: snapshot.ref.path, version: snapshot.updateTime ?? null })
function validate(selection: Selection) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(selection.projectId) || !validUid(selection.sourceUid) || !validOperation(selection.operationId) ||
    !["retry", "cancel-before-copy"].includes(selection.action)) throw new Error("Specify the exact project, source, operation and supported action.")
}

/** Administrative library only. Not exported as a callable or used by clients.
 * IAM authorizes the operator; a plan digest detects stale observations, not identity.
 * This never changes Auth, game records, statistics, or partially copied progress.
 */
export function accountMergeReconciliation(db: Firestore, auth: Auth, projectId: string) {
  if (auth.app.options.projectId !== projectId || getFirestore(auth.app) !== db) throw new Error("Auth, Firestore and the selected administrative project must match explicitly.")
  async function owner(uid: string): Promise<UserRecord | null> {
    try { return await auth.getUser(uid) } catch (error) {
      if ((error as { code?: string })?.code === "auth/user-not-found") return null
      throw new Error("Identity inspection failed; no reconciliation was applied.", { cause: error })
    }
  }
  async function read(tx: Transaction, selection: Selection) {
    const jobRef = db.doc(`accountMerges/${selection.sourceUid}`)
    const jobSnapshot = await tx.get(jobRef)
    const job = jobSnapshot.data()
    if (!job || !validUid(job.targetUid) || job.targetUid === selection.sourceUid) throw new Error("Operation is missing or has an invalid destination; preserve its records for investigation.")
    const paths = [`accountMergeLocks/${selection.sourceUid}`, `accountMergeLocks/${job.targetUid}`,
      `accountDeletions/${selection.sourceUid}`, `accountDeletions/${job.targetUid}`, `players/${job.targetUid}/privateStats/summary`]
    const snapshots = await Promise.all(paths.map(path => tx.get(db.doc(path))))
    const [imports, archives] = await Promise.all([
      tx.get(db.collection(`players/${job.targetUid}/games`).where("mergeOrigin.guestUid", "==", selection.sourceUid).limit(1)),
      tx.get(db.collection(`players/${job.targetUid}/mergedGuestGames`).where("sourceUid", "==", selection.sourceUid).limit(1)),
    ])
    return { job, jobRef, snapshots, hasCopies: !imports.empty || !archives.empty,
      versions: [jobSnapshot, ...snapshots, ...imports.docs, ...archives.docs].map(version) }
  }
  function plan(selection: Selection, expiresAt: number, state: Awaited<ReturnType<typeof read>>, source: UserRecord | null, target: UserRecord | null): ReconciliationPlan {
    const { job, snapshots, hasCopies } = state
    const [sourceLock, targetLock, sourceDeletion, targetDeletion, stats] = snapshots
    const blockers: string[] = []
    if (job.sourceUid !== selection.sourceUid || job.operationId !== selection.operationId || job.policyVersion !== 1 ||
      job.status !== "pending" || !count(job.imported) || !count(job.conflicts)) blockers.push("Operation identity, policy or pending state does not match.")
    if (sourceLock.data()?.jobId !== selection.sourceUid || sourceLock.data()?.role !== "source" ||
      targetLock.data()?.jobId !== selection.sourceUid || targetLock.data()?.role !== "target") blockers.push("Both exact account locks are required.")
    if (sourceDeletion.exists || targetDeletion.exists) blockers.push("An account has a deletion barrier.")
    if (job.retentionError || sourceLock.data()?.retentionError || targetLock.data()?.retentionError) blockers.push("Retention metadata needs separate investigation.")
    if (job.lease && (!(job.nextAttemptAt instanceof Timestamp) || job.nextAttemptAt.toMillis() > Date.now())) blockers.push("The worker lease is active or invalid.")
    if (!target) blockers.push("Destination identity is missing.")
    if (selection.action === "retry") {
      if (target && (target.disabled || !isLinked(target))) blockers.push("Destination must be an enabled supported linked identity.")
      if (source ? (!isGuest(source) || (source.disabled && !job.freeze)) : (job.retirement !== "requested" || job.phase !== "copied")) {
        blockers.push("Source identity is incompatible with automatic merge recovery.")
      }
    } else {
      if (!source || source.disabled) blockers.push("Source must exist and be enabled; this tool never re-enables Auth.")
      if (job.imported !== 0 || job.conflicts !== 0 || hasCopies || job.retirement || job.phase === "copied") blockers.push("Copying/retirement has occurred or cannot be ruled out.")
      if (![undefined, "source-games", "source-history", "target-games", "target-history", "copy"].includes(job.phase)) blockers.push("Unknown validation phase.")
      if (job.freeze && !(job.freeze === "requested" && job.phase === "copy" && source && isLinked(source))) {
        blockers.push("Frozen guest recovery cannot be cancelled by this tool.")
      }
      if (job.phase === "copy" && (job.cursor !== null || !count(job.sourceGameCount) ||
        !isDeepStrictEqual(summary((stats.data() ?? initialStats(job.targetUid)) as Stats), summary(job.copyStats)))) blockers.push("The untouched copy checkpoint and destination statistics must match.")
    }
    const digest = hash({ ...selection, expiresAt, versions: state.versions, hasCopies,
      // Keep provider identifiers, email and claims inside a hash; never output them.
      sourceIdentity: source?.toJSON() ?? null, targetIdentity: target?.toJSON() ?? null })
    return { ...selection, schemaVersion: 1, expiresAt, digest, blockers,
      summary: { targetUid: job.targetUid, status: typeof job.status === "string" ? job.status : "invalid",
        phase: typeof job.phase === "string" ? job.phase : "not-started", imported: count(job.imported) ? job.imported : null,
        conflicts: count(job.conflicts) ? job.conflicts : null, freeze: typeof job.freeze === "string" ? job.freeze : null,
        retirement: typeof job.retirement === "string" ? job.retirement : null, source: identitySummary(source), target: identitySummary(target) } }
  }
  async function inspect(selection: Selection): Promise<ReconciliationPlan> {
    validate(selection)
    if (selection.projectId !== projectId) throw new Error("The selected project does not match the administrative connection.")
    const state = await db.runTransaction(tx => read(tx, selection))
    const [source, target] = await Promise.all([owner(selection.sourceUid), owner(state.job.targetUid)])
    return plan(selection, Date.now() + 10 * 60_000, state, source, target)
  }
  async function apply(expected: ReconciliationPlan, confirmation: { projectId: string; digest: string; reference: string }) {
    validate(expected)
    if (expected.schemaVersion !== 1 || expected.projectId !== projectId || confirmation.projectId !== projectId ||
      confirmation.digest !== expected.digest || !/^[a-f0-9]{64}$/.test(expected.digest) ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(confirmation.reference) || !Number.isSafeInteger(expected.expiresAt) ||
      expected.expiresAt <= Date.now() || expected.expiresAt > Date.now() + 10 * 60_000) throw new Error("A current plan, exact confirmation and incident reference are required.")
    // Re-read Auth immediately before the transaction. Auth cannot participate
    // in a Firestore transaction; operators must quiesce administrative changes.
    const selection: Selection = { projectId, sourceUid: expected.sourceUid, operationId: expected.operationId, action: expected.action }
    const observed = await db.runTransaction(tx => read(tx, selection))
    const [source, target] = await Promise.all([owner(selection.sourceUid), owner(observed.job.targetUid)])
    return db.runTransaction(async tx => {
      const state = await read(tx, selection)
      const current = plan(selection, expected.expiresAt, state, source, target)
      if (current.digest !== expected.digest) throw new Error("Operation or identity changed. Inspect again before applying.")
      if (current.blockers.length) throw new Error("Reconciliation is blocked. Inspect the plan and resolve its prerequisites.")
      if (expected.expiresAt <= Date.now()) throw new Error("Plan expired. Inspect again.")
      const audit = { action: selection.action, reference: confirmation.reference, at: Timestamp.now() }
      if (selection.action === "retry") {
        tx.update(state.jobRef, { error: FieldValue.delete(), lease: FieldValue.delete(), nextAttemptAt: Timestamp.now(), updatedAt: Timestamp.now(), reconciliation: audit })
        return { status: "queued" as const, operationId: selection.operationId }
      }
      tx.set(state.jobRef, { sourceUid: selection.sourceUid, targetUid: state.job.targetUid, operationId: selection.operationId, policyVersion: 1,
        status: "cancelled", imported: 0, conflicts: 0, completedAt: Timestamp.now(), purgeAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60_000), reconciliation: audit })
      tx.delete(state.snapshots[0].ref)
      tx.delete(state.snapshots[1].ref)
      return { status: "cancelled" as const, operationId: selection.operationId }
    })
  }
  return { inspect, apply }
}
