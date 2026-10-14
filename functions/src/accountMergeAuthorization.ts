import { Auth, DecodedIdToken, UserRecord } from "firebase-admin/auth"
import { CallableRequest, HttpsError } from "firebase-functions/v2/https"
import { user } from "./accountAccess"
import { record } from "./gameEngine"

type MergeAuth = Pick<Auth, "verifyIdToken" | "getUser">
export interface AuthorizedMergeAccounts { sourceUid: string; targetUid: string; operationId: string; previousOperationId?: string }
const supportedProviders = new Set(["google.com", "apple.com"])
const credentialFailures = new Set([
  "auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token",
  "auth/argument-error", "auth/invalid-argument", "auth/user-disabled", "auth/user-not-found",
])

function denied(): never {
  throw new HttpsError("unauthenticated", "We couldn't verify both accounts. Sign in and try again.")
}
function validUid(uid: unknown): uid is string {
  return typeof uid === "string" && uid.length > 0 && uid.length <= 128 && !uid.includes("/")
}
function validSession(token: DecodedIdToken, owner: UserRecord, now: number): void {
  const signedInAt = token.auth_time
  if (owner.disabled || token.uid !== owner.uid || token.sub !== owner.uid || token.firebase?.tenant ||
    !Number.isSafeInteger(signedInAt) || signedInAt < 0 || signedInAt > now + 30) denied()
  if (owner.tokensValidAfterTime) {
    const validAfter = Date.parse(owner.tokensValidAfterTime) / 1000
    if (!Number.isFinite(validAfter) || signedInAt < validAfter) denied()
  }
}
async function authOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation() } catch (error) {
    // Never attach provider errors, claims, tokens, email addresses or user
    // records to the callable error. Operational failures remain retryable.
    if (credentialFailures.has((error as { code?: string })?.code || "")) denied()
    throw new HttpsError("unavailable", "Account verification is temporarily unavailable. Please try again.")
  }
}

/** Current ownership for status/recovery; accepted consent need not be repeated. */
export async function authorizeMergeRecovery(auth: MergeAuth, request: CallableRequest): Promise<string> {
  try {
    const uid = user(request)
    const owner = await authOperation(() => auth.getUser(uid))
    validSession(request.auth!.token, owner, Math.floor(Date.now() / 1000))
    return uid
  } catch (failure) {
    if (failure instanceof HttpsError && failure.code === "unauthenticated") {
      // Only a definitive failure of this caller's own session has this reason.
      // Operational errors stay unavailable; never tell clients to discard a
      // credential because an Auth lookup timed out or permissions are missing.
      throw new HttpsError("unauthenticated", "Sign in again to reopen your account.", { reason: "session-invalid" })
    }
    throw failure
  }
}

/**
 * Internal entry authorization only. `request.auth` must come from the verified
 * onCall middleware, never from JSON supplied by a client. The destination proof
 * is a Firebase ID token from a separate Auth session, not a Google/Apple token.
 * No token is persisted and no account/game state is changed here.
 *
 * A worker must still atomically reserve both accounts against gameplay,
 * competing merges and deletion before importing anything. This function is
 * deliberately not exported as a deployed callable on its own.
 */
export async function authorizeAccountMerge(
  auth: MergeAuth, request: CallableRequest, clock: () => number = Date.now,
): Promise<AuthorizedMergeAccounts> {
  const sourceUid = user(request)
  const data = record(request.data, ["confirmation", "targetIdToken", "operationId", "previousOperationId"])
  if (typeof data.operationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.operationId) ||
    (data.previousOperationId !== undefined && (typeof data.previousOperationId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.previousOperationId))) ||
    data.confirmation !== "MERGE" || typeof data.targetIdToken !== "string" ||
    data.targetIdToken.length === 0 || data.targetIdToken.length > 16384 || /\s/.test(data.targetIdToken)) {
    throw new HttpsError("invalid-argument", "Confirm the merge and verify the saved profile.")
  }
  const sourceToken = request.auth!.token
  if (sourceToken.firebase?.sign_in_provider !== "anonymous" || sourceToken.firebase?.tenant ||
    sourceToken.uid !== sourceUid || sourceToken.sub !== sourceUid) denied()
  const targetIdToken = data.targetIdToken
  const [source, targetToken] = await Promise.all([
    authOperation(() => auth.getUser(sourceUid)),
    authOperation(() => auth.verifyIdToken(targetIdToken, true)),
  ])
  const targetUid = targetToken.uid
  if (!validUid(targetUid) || targetUid === sourceUid || targetToken.sub !== targetUid) denied()
  const target = await authOperation(() => auth.getUser(targetUid))
  const now = Math.floor(clock() / 1000)
  if (!Number.isSafeInteger(now)) throw new HttpsError("internal", "Account verification is unavailable.")
  validSession(sourceToken, source, now)
  validSession(targetToken, target, now)
  // A previously issued anonymous token is not proof that the source is still
  // a guest: it may have been linked on another device since that token issued.
  if (source.uid !== sourceUid || source.providerData.length || source.email || source.phoneNumber) denied()
  const provider = targetToken.firebase?.sign_in_provider
  const identities = targetToken.firebase?.identities?.[provider]
  if (!supportedProviders.has(provider) || !Array.isArray(identities) ||
    !target.providerData.some(identity => identity.providerId === provider && identities.includes(identity.uid))) denied()
  // Token refresh changes iat, not auth_time; an old session must reauthenticate.
  if (now - targetToken.auth_time > 300) {
    throw new HttpsError("failed-precondition", "Verify your saved profile again before combining progress.", { reason: "reauthentication-required" })
  }
  return { sourceUid, targetUid, operationId: data.operationId, ...(data.previousOperationId ? { previousOperationId: data.previousOperationId } : {}) }
}
