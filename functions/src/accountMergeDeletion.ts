import { Firestore } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"

/** Called behind an accepted deletion barrier, before declaring deletion done. */
export async function deleteMergeProvenance(db: Firestore, uid: string): Promise<void> {
  // Archives and per-game provenance live below players/{uid}, which the main
  // deletion worker recursively erases. Completed merges already removed source
  // Auth/data; these records are their remaining cross-account identifiers.
  for (;;) {
    const jobs = await db.collection("accountMerges").where("targetUid", "==", uid).limit(20).get()
    if (jobs.empty) break
    for (const job of jobs.docs) await db.runTransaction(async tx => {
      const current = (await tx.get(job.ref)).data()
      if (!current) return
      if (current.targetUid !== uid || !["complete", "cancelled"].includes(current.status)) {
        throw new HttpsError("failed-precondition", "An account operation needs review before deletion can finish.")
      }
      tx.delete(job.ref)
    })
  }
  const source = db.doc(`accountMerges/${uid}`)
  await db.runTransaction(async tx => {
    const current = (await tx.get(source)).data()
    if (!current) return
    if (current.sourceUid !== uid || current.status !== "cancelled") {
      throw new HttpsError("failed-precondition", "An account operation needs review before deletion can finish.")
    }
    tx.delete(source)
  })
  // Retired source tombstones contain no target/job ID and are deliberately
  // retained for their 24-hour security window against already-issued tokens.
}
