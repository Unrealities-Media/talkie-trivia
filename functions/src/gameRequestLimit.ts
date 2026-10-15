import { Firestore } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { requireActiveAccount } from "./accountAccess"

// Shared across gameplay endpoints and function instances. Allow normal bursts,
// then recover one request every two seconds, independently of the game clock.
export const GAME_REQUEST_CAPACITY = 30
export const GAME_REQUEST_REFILL_MS = 2000

export async function consumeGameRequest(db: Firestore, uid: string): Promise<void> {
  const counter = db.doc(`players/${uid}/privateRateLimits/gameplay`)
  await db.runTransaction(async tx => {
    const [snapshot, deletion, mergeLock] = await Promise.all([
      tx.get(counter), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`)),
    ])
    // A stale token cannot recreate metadata after deletion or during a merge.
    requireActiveAccount(deletion, mergeLock)
    const stored = snapshot.data()
    if (snapshot.exists && (!Number.isFinite(stored?.tokens) || stored!.tokens < 0 || stored!.tokens > GAME_REQUEST_CAPACITY ||
      !Number.isSafeInteger(stored?.updatedAt) || stored!.updatedAt < 0)) {
      throw new HttpsError("internal", "The game service is temporarily unavailable.")
    }
    const now = Date.now()
    const updatedAt = Math.max(now, stored?.updatedAt ?? now)
    const tokens = snapshot.exists
      ? Math.min(GAME_REQUEST_CAPACITY, stored!.tokens + Math.max(0, now - stored!.updatedAt) / GAME_REQUEST_REFILL_MS)
      : GAME_REQUEST_CAPACITY
    if (tokens < 1) {
      throw new HttpsError("resource-exhausted", "Please wait a few seconds before trying again. Your saved progress is safe.",
        { retryAfterMs: Math.ceil((1 - tokens) * GAME_REQUEST_REFILL_MS + updatedAt - now) })
    }
    tx.set(counter, { tokens: tokens - 1, updatedAt })
  })
}
