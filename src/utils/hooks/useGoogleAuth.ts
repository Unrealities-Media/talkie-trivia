import { useState, useCallback, useRef } from "react"
import { AuthCredential, GoogleAuthProvider, getAuth, linkWithCredential, signInWithCredential, signOut, reauthenticateWithCredential, User } from "firebase/auth"
import { clearGoogleIdentity, useGoogleIdentity } from "./useGoogleIdentity"
import Constants from "expo-constants"
import { analyticsService } from "../analyticsService"
import { gameService } from "../../services/gameService"
import { deletionStorage } from "../../services/deletionStorage"
import { mergeStorage } from "../../services/mergeStorage"
import { isLocalDemoIdentity } from "../../services/localDemoIdentity"

export function useGoogleAuth(onAuthStateChange: (user: User | null) => void | Promise<void>, onSignedOut?: () => Promise<void>, onCollision?: (sourceUid: string, credential: AuthCredential) => Promise<void>) {
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const busy = useRef(false)
  const switchCredential = useRef<{ sourceUid: string; credential: AuthCredential } | null>(null)
  const [existingAccountPending, setExistingAccountPending] = useState(false)
  const cancelAccountSwitch = useCallback(() => {
    if (busy.current) return
    switchCredential.current = null
    setExistingAccountPending(false)
  }, [])
  const requestIdentity = useGoogleIdentity()

  const handleSignIn = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setIsLoading(true)
    setAuthError(null)
    switchCredential.current = null
    setExistingAccountPending(false)
    const auth = getAuth()
    const source = auth.currentUser
    try {
      if (Constants.expoConfig?.extra?.googleConfigured === false && !isLocalDemoIdentity()) {
        setAuthError("Google sign-in is not configured for this development build.")
        return
      }
      if (await deletionStorage.read()) throw new Error("account-deletion-pending")
      if (await mergeStorage.read()) throw new Error("account-merge-pending")
      if (source) await gameService.resumePendingAction(source.uid)
      if (auth.currentUser?.uid !== source?.uid) throw new Error("account-changed")
      analyticsService.trackGoogleSignInStart()
      const idToken = await requestIdentity()
      if (idToken === null) return
      // A provider response must not authenticate a different session opened meanwhile.
      if (auth.currentUser?.uid !== source?.uid) throw new Error("account-changed")
      const credential = GoogleAuthProvider.credential(idToken)
      let result
      try {
        result = source?.isAnonymous ? await linkWithCredential(source, credential) : await signInWithCredential(auth, credential)
      } catch (error) {
        if (source?.isAnonymous && !onCollision && (error as { code?: string }).code === "auth/credential-already-in-use") {
          if (auth.currentUser?.uid !== source.uid) throw new Error("account-changed", { cause: error })
          switchCredential.current = { sourceUid: source.uid, credential }
          setExistingAccountPending(true)
        }
        if (source?.isAnonymous && onCollision && (error as { code?: string }).code === "auth/credential-already-in-use") {
          if (auth.currentUser?.uid !== source.uid) throw new Error("account-changed", { cause: error })
          await onCollision(source.uid, credential)
          return
        }
        throw error
      }
      if (auth.currentUser?.uid !== result.user.uid) throw new Error("account-changed")
      await onAuthStateChange(result.user)
      analyticsService.trackGoogleSignInSuccess(result.user.uid)
    } catch (error) {
      const code = (error as { code?: string }).code
      // Never fall back to signInWithCredential here: that abandons guest progress.
      setAuthError(code === "auth/credential-already-in-use" || code === "auth/email-already-in-use"
        ? "That Google account already has a saved profile. Your guest progress is safe. You can open the existing account separately; combining progress isn't available yet."
        : "We couldn't connect your Google account. Your progress is safe. Check your connection and try again.")
      analyticsService.trackGoogleSignInFailure(code || "unknown")
    } finally { busy.current = false; setIsLoading(false) }
  }, [requestIdentity, onAuthStateChange, onCollision])

  const confirmAccountSwitch = useCallback(async () => {
    const pending = switchCredential.current
    if (busy.current || !pending) return
    busy.current = true
    setIsLoading(true)
    setAuthError(null)
    try {
      const auth = getAuth()
      if (auth.currentUser?.uid !== pending.sourceUid || !auth.currentUser.isAnonymous) throw new Error("account-changed")
      if (await deletionStorage.read() || await mergeStorage.read()) throw new Error("account-operation-pending")
      await gameService.resumePendingAction(pending.sourceUid)
      if (auth.currentUser?.uid !== pending.sourceUid) throw new Error("account-changed")
      const result = await signInWithCredential(auth, pending.credential)
      if (auth.currentUser?.uid !== result.user.uid) throw new Error("account-changed")
      await onAuthStateChange(result.user)
    } catch {
      setAuthError("We couldn't open your saved account. Check your connection and sign in again.")
    } finally {
      switchCredential.current = null
      setExistingAccountPending(false)
      busy.current = false
      setIsLoading(false)
    }
  }, [onAuthStateChange])

  const handleSignOut = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setIsLoading(true)
    setAuthError(null)
    const auth = getAuth()
    const source = auth.currentUser
    try {
      if (await deletionStorage.read()) throw new Error("account-deletion-pending")
      if (await mergeStorage.read()) throw new Error("account-merge-pending")
      // Retain both the session and its durable outbox if a move cannot be saved.
      if (source) await gameService.resumePendingAction(source.uid)
      if (auth.currentUser?.uid !== source?.uid) throw new Error("account-changed")
      await clearGoogleIdentity()
      if (auth.currentUser?.uid !== source?.uid) throw new Error("account-changed")
      await signOut(auth)
      analyticsService.trackSignOut()
      await onSignedOut?.()
    } catch {
      setAuthError("We couldn't save your pending progress and sign out. Check your connection and try again.")
    } finally { busy.current = false; setIsLoading(false) }
  }, [onSignedOut])

  const withDeletionVerification = useCallback(async (uid: string, operation: () => Promise<void>) => {
    if (busy.current) throw new Error("Another account operation is in progress.")
    busy.current = true
    setIsLoading(true)
    try {
      const auth = getAuth()
      if (await mergeStorage.read()) throw new Error("Finish combining accounts before requesting deletion.")
      const source = auth.currentUser
      if (!source || source.uid !== uid) throw new Error("Your account changed. Reopen Profile > Settings before continuing.")
      if (!source.isAnonymous && Constants.expoConfig?.extra?.googleConfigured === false && !isLocalDemoIdentity()) throw new Error("Google sign-in is not configured for this build.")
      if (!source.isAnonymous) {
        const idToken = await requestIdentity()
        if (idToken === null) throw Object.assign(new Error("Verification cancelled. No new deletion request was sent."), { code: "account/verification-cancelled" })
        if (auth.currentUser?.uid !== uid) throw new Error("Account verification failed. No new deletion request was sent.")
        await reauthenticateWithCredential(source, GoogleAuthProvider.credential(idToken))
        await source.getIdToken(true)
      }
      if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. No new deletion request was sent.")
      await operation()
    } finally { busy.current = false; setIsLoading(false) }
  }, [requestIdentity])

  const verifyGoogleAccount = useCallback(async (operation: (credential: AuthCredential) => Promise<void>) => {
    if (busy.current) throw new Error("Another account operation is in progress.")
    busy.current = true
    setIsLoading(true)
    try {
      if (Constants.expoConfig?.extra?.googleConfigured === false && !isLocalDemoIdentity()) throw new Error("Google sign-in is not configured.")
      if (await deletionStorage.read()) throw new Error("Finish account deletion first.")
      const idToken = await requestIdentity()
      if (idToken === null) throw Object.assign(new Error("Verification cancelled."), { code: "account/verification-cancelled" })
      await operation(GoogleAuthProvider.credential(idToken))
    } finally { busy.current = false; setIsLoading(false) }
  }, [requestIdentity])

  return { isLoading, authError, handleSignIn, handleSignOut, withDeletionVerification, verifyGoogleAccount,
    existingAccountPending, confirmAccountSwitch, cancelAccountSwitch }
}
