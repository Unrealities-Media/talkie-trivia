jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class extends Error { constructor(public code: string, message: string, public details?: unknown) { super(message) } },
}))
import { Auth, DecodedIdToken, UserRecord } from "firebase-admin/auth"
import { CallableRequest } from "firebase-functions/v2/https"
import { authorizeAccountMerge, authorizeMergeRecovery } from "./accountMergeAuthorization"

const now = Date.parse("2026-10-13T12:00:00.000Z")
const seconds = now / 1000
let source: UserRecord
let target: UserRecord
let sourceToken: DecodedIdToken
let targetToken: DecodedIdToken
let request: CallableRequest
const auth = { getUser: jest.fn(), verifyIdToken: jest.fn() } as unknown as Pick<Auth, "getUser" | "verifyIdToken">
const authorize = (clock = () => now) => authorizeAccountMerge(auth, request, clock)

beforeEach(() => {
  jest.resetAllMocks()
  source = { uid: "guest", disabled: false, providerData: [], tokensValidAfterTime: new Date(now - 86400000).toUTCString() } as unknown as UserRecord
  target = { uid: "saved", disabled: false, providerData: [{ providerId: "google.com", uid: "google-sub" }], tokensValidAfterTime: new Date(now - 86400000).toUTCString() } as unknown as UserRecord
  sourceToken = { uid: "guest", sub: "guest", auth_time: seconds - 86400, firebase: { sign_in_provider: "anonymous", identities: {} } } as DecodedIdToken
  targetToken = { uid: "saved", sub: "saved", auth_time: seconds, firebase: { sign_in_provider: "google.com", identities: { "google.com": ["google-sub"] } } } as DecodedIdToken
  request = { auth: { uid: "guest", token: sourceToken }, data: { confirmation: "MERGE", targetIdToken: "firebase-target-proof", operationId: "confirmation-00001" } } as CallableRequest
  ;(auth.getUser as jest.Mock).mockImplementation(async uid => structuredClone(uid === "guest" ? source : target))
  ;(auth.verifyIdToken as jest.Mock).mockImplementation(async () => structuredClone(targetToken))
})

it("requires a revocation-checked Firebase destination proof and returns only the two verified UIDs", async () => {
  expect(await authorize()).toEqual({ sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001" })
  expect(auth.verifyIdToken).toHaveBeenCalledWith("firebase-target-proof", true)
  expect(auth.getUser).toHaveBeenCalledWith("guest")
  expect(auth.getUser).toHaveBeenCalledWith("saved")
  // A guest can have played for months without a provider to reauthenticate.
  expect(sourceToken.auth_time).toBeLessThan(seconds - 300)
})
it("accepts a recently authenticated Apple destination with a matching current provider identity", async () => {
  target = { ...target, providerData: [{ providerId: "apple.com", uid: "apple-sub" }] } as UserRecord
  targetToken.firebase = { sign_in_provider: "apple.com", identities: { "apple.com": ["apple-sub"] } }
  expect(await authorize()).toEqual({ sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001" })
})
it.each([undefined, null, "", "short", "bad/confirmation-00001", "a".repeat(81)])("rejects an invalid confirmation identity %j before Auth reads", async operationId => {
  request.data.operationId = operationId
  await expect(authorize()).rejects.toMatchObject({ code: "invalid-argument" })
  expect(auth.getUser).not.toHaveBeenCalled()
})
it.each([undefined, { uid: "" }, { uid: "bad/path" }, { uid: "a".repeat(129) }])("rejects missing/invalid callable authentication %j", authData => {
  request.auth = authData as CallableRequest["auth"]
  return expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each([
  null, [], {}, { confirmation: "SIGN_IN", targetIdToken: "token" },
  { confirmation: "MERGE", targetIdToken: "token", targetUid: "victim" },
  { confirmation: "MERGE", targetIdToken: "token", sourceUid: "victim" },
  { confirmation: "MERGE", targetIdToken: "token", games: [] },
  { confirmation: "MERGE", targetIdToken: "" },
  { confirmation: "MERGE", targetIdToken: "token with spaces" },
  { confirmation: "MERGE", targetIdToken: "x".repeat(16385) },
])("rejects unconfirmed, overprivileged or malformed request %# before querying Auth", async data => {
  request.data = data && !Array.isArray(data) ? { operationId: "confirmation-00001", ...data } : data
  await expect(authorize()).rejects.toMatchObject({ code: "invalid-argument" })
  expect(auth.getUser).not.toHaveBeenCalled()
  expect(auth.verifyIdToken).not.toHaveBeenCalled()
})
it.each(["password", "google.com", "apple.com", "custom"])("does not merge a source authenticated with %s as a guest", async provider => {
  sourceToken.firebase.sign_in_provider = provider
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
  expect(auth.getUser).not.toHaveBeenCalled()
})
it("rejects a caller UID that does not match its verified token", async () => {
  sourceToken.uid = "another-user"
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
  expect(auth.verifyIdToken).not.toHaveBeenCalled()
})
it.each([
  { providerData: [{ providerId: "google.com", uid: "newly-linked" }] },
  { email: "private@example.test" }, { phoneNumber: "+15555550123" }, { disabled: true },
])("rejects changed current source state despite an old anonymous claim %j", async patch => {
  source = { ...source, ...patch } as UserRecord
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each(["guest", "bad/path", "", "a".repeat(129)])("rejects identical or invalid destination UID %#", async uid => {
  targetToken.uid = uid
  targetToken.sub = uid
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
  expect(auth.getUser).toHaveBeenCalledTimes(1)
})
it("rejects inconsistent destination subjects", async () => {
  targetToken.sub = "another-user"
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each(["source", "target"])("rejects tenant identities for the single-project %s account", async side => {
  ;(side === "source" ? sourceToken : targetToken).firebase.tenant = "other-tenant"
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each(["anonymous", "password", "custom"])("requires destination reauthentication through a supported linked provider, not %s", async provider => {
  targetToken.firebase.sign_in_provider = provider
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each([
  { providerData: [] },
  { providerData: [{ providerId: "apple.com", uid: "google-sub" }] },
  { providerData: [{ providerId: "google.com", uid: "different-sub" }] },
])("rejects unlinked or replaced destination provider identity %#", async ({ providerData }) => {
  target = { ...target, providerData } as UserRecord
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it("rejects a destination disabled after verification", async () => {
  ;(auth.verifyIdToken as jest.Mock).mockImplementation(async () => {
    target = { ...target, disabled: true } as UserRecord
    return structuredClone(targetToken)
  })
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each([undefined, NaN, Infinity, -1, seconds + 31])("rejects malformed or future source authentication time %s", async authTime => {
  sourceToken.auth_time = authTime as number
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each([undefined, NaN, Infinity, -1, seconds + 31])("rejects malformed or future destination authentication time %s", async authTime => {
  targetToken.auth_time = authTime as number
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each([seconds - 300, seconds + 30])("accepts destination time at the defined freshness/skew boundary %s", async authTime => {
  targetToken.auth_time = authTime
  await expect(authorize()).resolves.toEqual({ sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001" })
})
it("requires reauthentication rather than token refresh for an old destination session", async () => {
  targetToken.auth_time = seconds - 301
  targetToken.iat = seconds
  await expect(authorize()).rejects.toMatchObject({ code: "failed-precondition", details: { reason: "reauthentication-required" } })
})
it("checks freshness after asynchronous Auth operations finish", async () => {
  targetToken.auth_time = seconds - 290
  let elapsed = 0
  ;(auth.verifyIdToken as jest.Mock).mockImplementation(async () => { elapsed = 20000; return structuredClone(targetToken) })
  await expect(authorize(() => now + elapsed)).rejects.toMatchObject({ code: "failed-precondition" })
})
it.each(["source", "target"])("rejects revoked %s credentials even if the callable/token verification did not catch them", async side => {
  if (side === "source") source = { ...source, tokensValidAfterTime: new Date(now).toUTCString() } as UserRecord
  else target = { ...target, tokensValidAfterTime: new Date(now + 1000).toUTCString() } as UserRecord
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated" })
})
it.each(["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/argument-error", "auth/user-disabled"])("sanitizes destination verification failure %s", async code => {
  ;(auth.verifyIdToken as jest.Mock).mockRejectedValue({ code, message: "private@example.test firebase-target-proof" })
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated", message: "We couldn't verify both accounts. Sign in and try again." })
})
it("treats deleted accounts as invalid credentials without disclosing the missing UID", async () => {
  ;(auth.getUser as jest.Mock).mockRejectedValue({ code: "auth/user-not-found", message: "private account record" })
  await expect(authorize()).rejects.toMatchObject({ code: "unauthenticated", message: "We couldn't verify both accounts. Sign in and try again." })
})
it("reports a retryable service outage without leaking Auth diagnostics", async () => {
  ;(auth.getUser as jest.Mock).mockRejectedValue(new Error("private@example.test service-account credential detail"))
  await expect(authorize()).rejects.toMatchObject({ code: "unavailable", message: "Account verification is temporarily unavailable. Please try again." })
})

describe("recovery session invalidation contract", () => {
  beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now) })
  afterEach(() => { jest.restoreAllMocks() })
  it("accepts the current caller without changing merge creation authorization", async () => {
    await expect(authorizeMergeRecovery(auth, request)).resolves.toBe("guest")
  })
  it.each(["revoked", "disabled", "deleted"])("marks a definitively %s caller session for recovery", async reason => {
    if (reason === "revoked") source = { ...source, tokensValidAfterTime: new Date(now).toUTCString() } as UserRecord
    if (reason === "disabled") source = { ...source, disabled: true } as UserRecord
    if (reason === "deleted") (auth.getUser as jest.Mock).mockRejectedValue({ code: "auth/user-not-found", message: "private diagnostic" })
    await expect(authorizeMergeRecovery(auth, request)).rejects.toMatchObject({
      code: "unauthenticated", message: "Sign in again to reopen your account.", details: { reason: "session-invalid" },
    })
  })
  it.each(["auth/internal-error", "auth/insufficient-permission", "app/network-error"])("does not instruct logout on %s", async code => {
    ;(auth.getUser as jest.Mock).mockRejectedValue({ code, message: "private diagnostic" })
    await expect(authorizeMergeRecovery(auth, request)).rejects.toMatchObject({ code: "unavailable", details: undefined })
  })
})
