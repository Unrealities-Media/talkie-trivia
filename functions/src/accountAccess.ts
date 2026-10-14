import { CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { DocumentSnapshot } from "firebase-admin/firestore"

export function user(request: CallableRequest): string {
  const uid = request.auth?.uid
  if (typeof uid !== "string" || !uid.length || uid.length > 128 || uid.includes("/")) {
    throw new HttpsError("unauthenticated", "Sign in to continue.")
  }
  return uid
}

export function requireNoAccountMerge(mergeLock: DocumentSnapshot): void {
  if (mergeLock.exists) throw new HttpsError("failed-precondition", "Account progress is being combined. Reopen account recovery to continue.", { reason: "account-merge-pending" })
}

export function requireActiveAccount(deletion: DocumentSnapshot, mergeLock: DocumentSnapshot): void {
  if (deletion.exists) throw new HttpsError("permission-denied", "Account deletion has been requested.")
  requireNoAccountMerge(mergeLock)
}
