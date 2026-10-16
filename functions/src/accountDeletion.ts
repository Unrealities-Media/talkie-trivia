import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto"
import { Auth } from "firebase-admin/auth"
import { FieldPath, FieldValue, Firestore, Timestamp } from "firebase-admin/firestore"
import { CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { warn } from "firebase-functions/logger"
import { record } from "./gameEngine"
import { user, requireNoAccountMerge } from "./accountAccess"
import { deleteMergeProvenance } from "./accountMergeDeletion"

const leaseMs = 10 * 60_000
const retentionMs = 24 * 60 * 60_000
const receiptRetentionMs = 30 * retentionMs
const notFound = (error: unknown) => (error as { code?: string }).code === "auth/user-not-found"
function matches(secret: unknown, stored: unknown): boolean {
  return typeof secret === "string" && /^[a-f0-9]{64}$/.test(secret) && typeof stored === "string" &&
    stored.length === 64 && timingSafeEqual(Buffer.from(secret), Buffer.from(stored))
}

/** All operations are idempotent. The durable barrier survives timeouts and Auth deletion. */
export function accountDeletion(db: Firestore, auth: Auth) {
  async function prepare(request: CallableRequest) {
    const uid = user(request)
    record(request.data, [])
    const owner = await auth.getUser(uid)
    if (owner.disabled) throw new HttpsError("permission-denied", "This account is unavailable.")
    const ref = db.doc(`accountDeletionReceipts/${uid}`)
    return db.runTransaction(async tx => {
      const [receipt, mergeLock] = await Promise.all([tx.get(ref), tx.get(db.doc(`accountMergeLocks/${uid}`))])
      requireNoAccountMerge(mergeLock)
      const existing = receipt.data()
      if (existing && (!existing.expiresAt || existing.expiresAt.toMillis() > Date.now())) return { secret: existing.secret }
      const secret = randomBytes(32).toString("hex")
      tx.set(ref, { secret, status: "prepared", expiresAt: Timestamp.fromMillis(Date.now() + retentionMs) })
      return { secret }
    })
  }

  // A scoped receipt can only reveal deletion status; it cannot authorize deletion.
  async function status(request: CallableRequest) {
    const data = record(request.data, ["uid", "secret"])
    if (typeof data.uid !== "string" || !data.uid.length || data.uid.length > 128 || data.uid.includes("/") ||
      typeof data.secret !== "string" || !/^[a-f0-9]{64}$/.test(data.secret)) throw new HttpsError("invalid-argument", "Invalid deletion receipt.")
    const receipt = (await db.doc(`accountDeletionReceipts/${data.uid}`).get()).data()
    if (!receipt || !matches(data.secret, receipt.secret) || (receipt.expiresAt && receipt.expiresAt.toMillis() <= Date.now())) return { status: "unknown" }
    return { status: receipt.status }
  }
  async function process(uid: string): Promise<boolean> {
    const ref = db.doc(`accountDeletions/${uid}`)
    const lease = randomUUID()
    const claimed = await db.runTransaction(async tx => {
      const job = (await tx.get(ref)).data()
      if (!job || job.status !== "pending" || job.nextAttemptAt.toMillis() > Date.now()) return false
      tx.update(ref, { lease, nextAttemptAt: Timestamp.fromMillis(Date.now() + leaseMs), attempts: FieldValue.increment(1) })
      return true
    })
    if (!claimed) return (await ref.get()).data()?.status === "complete"
    try {
      // Disable refresh/new sign-in first. Existing tokens are blocked by the barrier.
      try { await auth.updateUser(uid, { disabled: true }) } catch (error) { if (!notFound(error)) throw error }
      await db.recursiveDelete(db.doc(`players/${uid}`))
      await db.recursiveDelete(db.doc(`playerStats/${uid}`))
      // Legacy documents used playerID; delete every page, including orphaned subcollections.
      for (;;) {
        const page = await db.collection("playerGames").where("playerID", "==", uid).limit(100).get()
        if (page.empty) break
        for (const game of page.docs) await db.recursiveDelete(game.ref)
      }
      // Old clients could leave incomplete records with no playerID. Match only the
      // exact historical UID-date key, never another UID that shares a prefix.
      let cursor: string | undefined
      for (;;) {
        let query = db.collection("playerGames").orderBy(FieldPath.documentId()).endAt(`${uid}-\uf8ff`).limit(100)
        query = cursor ? query.startAfter(cursor) : query.startAt(`${uid}-`)
        const page = await query.get()
        if (page.empty) break
        for (const game of page.docs) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(game.id.slice(uid.length + 1))) await db.recursiveDelete(game.ref)
        }
        cursor = page.docs[page.docs.length - 1].id
      }
      await deleteMergeProvenance(db, uid)
      try { await auth.deleteUser(uid) } catch (error) { if (!notFound(error)) throw error }
      return await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data()
        if (current?.lease !== lease) return current?.status === "complete"
        tx.update(ref, { status: "complete", completedAt: Timestamp.now(), purgeAt: Timestamp.fromMillis(Date.now() + retentionMs), nextAttemptAt: FieldValue.delete(), lease: FieldValue.delete() })
        tx.update(db.doc(`accountDeletionReceipts/${uid}`), { status: "complete", expiresAt: Timestamp.fromMillis(Date.now() + receiptRetentionMs) })
        return true
      })
    } catch {
      // Do not log emails, tokens, UIDs or raw provider/database errors.
      warn("account_deletion_retry_required")
      return false // The durable lease becomes eligible again even if this invocation crashes.
    }
  }

  async function request(request: CallableRequest): Promise<{ accepted: true; complete: boolean }> {
    const uid = user(request)
    const data = record(request.data, ["confirmation", "secret"])
    if (data.confirmation !== "DELETE") throw new HttpsError("invalid-argument", "Confirm account deletion.")
    const receiptRef = db.doc(`accountDeletionReceipts/${uid}`)
    const receipt = (await receiptRef.get()).data()
    if (!receipt || !matches(data.secret, receipt.secret) || (receipt.expiresAt && receipt.expiresAt.toMillis() <= Date.now())) throw new HttpsError("failed-precondition", "Prepare a deletion receipt first.")
    if (receipt.status === "complete") return { accepted: true, complete: true }
    const ref = db.doc(`accountDeletions/${uid}`)
    // Retrying an accepted request must work even after credentials have been removed.
    const previous = await ref.get()
    if (!previous.exists) {
      try {
        const owner = await auth.getUser(uid).catch(error => {
          if (notFound(error)) throw new HttpsError("unauthenticated", "Sign in to continue.")
          throw error
        })
        if (owner.disabled) throw new HttpsError("permission-denied", "This account is unavailable.")
        const authTime = request.auth?.token.auth_time
        const now = Math.floor(Date.now() / 1000)
        // Anonymous accounts have no provider to reauthenticate with. Linked accounts do.
        if (owner.providerData.length && (typeof authTime !== "number" || !Number.isSafeInteger(authTime) || authTime > now + 30 || now - authTime > 300)) {
          throw new HttpsError("failed-precondition", "Verify your sign-in before deleting your account.", { reason: "reauthentication-required" })
        }
        if (typeof authTime !== "number" || !Number.isSafeInteger(authTime) || authTime > now + 30 ||
          (owner.tokensValidAfterTime && authTime < Date.parse(owner.tokensValidAfterTime) / 1000)) {
          throw new HttpsError("unauthenticated", "Your session is no longer valid.")
        }
      } catch (error) {
        // A simultaneous accepted request may already have disabled/deleted Auth.
        if (!(await ref.get()).exists) throw error
      }
      await db.runTransaction(async tx => {
        const [job, receiptDoc, mergeLock] = await Promise.all([tx.get(ref), tx.get(receiptRef), tx.get(db.doc(`accountMergeLocks/${uid}`))])
        requireNoAccountMerge(mergeLock)
        const currentReceipt = receiptDoc.data()
        if (!currentReceipt || !matches(data.secret, currentReceipt.secret) || (currentReceipt.expiresAt && currentReceipt.expiresAt.toMillis() <= Date.now())) throw new HttpsError("failed-precondition", "Prepare a deletion receipt first.")
        if (!job.exists) {
          tx.create(ref, { status: "pending", requestedAt: Timestamp.now(), nextAttemptAt: Timestamp.now(), attempts: 0 })
          tx.update(receiptRef, { status: "pending", expiresAt: FieldValue.delete() })
        }
      })
    }
    return { accepted: true, complete: await process(uid) }
  }

  async function retry(): Promise<void> {
    const due = await db.collection("accountDeletions").where("nextAttemptAt", "<=", Timestamp.now()).orderBy("nextAttemptAt").limit(20).get()
    // Bound concurrency and let old failures move behind newer work via the lease.
    for (const job of due.docs) await process(job.id)
    const expired = await db.collection("accountDeletions").where("purgeAt", "<=", Timestamp.now()).limit(100).get()
    for (const job of expired.docs) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(job.ref)).data()
        if (current?.status === "complete" && current.purgeAt.toMillis() <= Date.now()) tx.delete(job.ref)
      })
    }
    const receipts = await db.collection("accountDeletionReceipts").where("expiresAt", "<=", Timestamp.now()).limit(100).get()
    for (const receipt of receipts.docs) await db.runTransaction(async tx => {
      const current = (await tx.get(receipt.ref)).data()
      if (current?.expiresAt && current.expiresAt.toMillis() <= Date.now()) tx.delete(receipt.ref)
    })
  }
  return { prepare, status, request, process, retry }
}
