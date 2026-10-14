import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react"
import { AppState } from "react-native"
import { AuthCredential, getAuth, onAuthStateChanged, User, signInAnonymously, signOut } from "firebase/auth"
import Player from "../models/player"
import { useGoogleAuth } from "../utils/hooks/useGoogleAuth"
import { analyticsService } from "../utils/analyticsService"
import { gameService } from "../services/gameService"
import { useGameStore } from "../state/gameStore"
import { deletionStorage, DeletionReceipt } from "../services/deletionStorage"
import { accountDeletionService } from "../services/accountDeletionService"
import { sessionStorage, SavedSession } from "../services/sessionStorage"
import { mergeStorage, MergeReceipt } from "../services/mergeStorage"
import { accountMergeService } from "../services/accountMergeService"
import { openMergeIdentity, MergeIdentity } from "../services/mergeIdentity"
import { useFirebaseEmulators } from "../config/firebaseEnvironment"

interface AuthState {
  player: Player | null
  user: User | null
  loading: boolean
  error: string | null
  accountError: string | null
  retryAuthentication: () => Promise<void>
  handleSignIn: () => Promise<void>
  handleSignOut: () => Promise<void>
  isSigningIn: boolean
  deletion: DeletionReceipt | null
  deletionError: string | null
  isDeleting: boolean
  handleDeleteAccount: () => Promise<void>
  refreshDeletion: () => Promise<void>
  startNewGuest: () => Promise<void>
  lostSession: SavedSession | null
  replaceLostSession: () => Promise<void>
  merge: MergeReceipt | null
  mergeProposal: { sourceUid: string; accountLabel: string } | null
  mergeError: string | null
  isMerging: boolean
  confirmMerge: () => Promise<void>
  continueMerge: () => Promise<void>
  cancelMerge: () => Promise<void>
  finishMerge: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)
const sessionError = "We couldn't load your account. Check your connection and try again."

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletion, setDeletion] = useState<DeletionReceipt | null>(null)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lostSession, setLostSession] = useState<SavedSession | null>(null)
  const lastSession = useRef<SavedSession | null>(null)
  const guestRequest = useRef<ReturnType<typeof signInAnonymously> | null>(null)
  const recoveryBusy = useRef(false)
  const deletionBusy = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(false)
  const activeUid = useRef<string | null>(null)
  const [merge, setMerge] = useState<MergeReceipt | null>(null)
  const [mergeProposal, setMergeProposal] = useState<{ sourceUid: string; accountLabel: string } | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const mergeIdentity = useRef<MergeIdentity | null>(null)
  const proposalSource = useRef<string | null>(null)
  const mergeBusy = useRef(false)

  const loadSession = useCallback(async function load(firebaseUser: User | null, allowNewGuest = false): Promise<void> {
    if (!mounted.current) return
    const token = ++generation.current
    const current = () => mounted.current && token === generation.current
    if (activeUid.current !== firebaseUser?.uid || !firebaseUser) {
      useGameStore.getState().resetSession()
      analyticsService.clearIdentity()
      activeUid.current = firebaseUser?.uid ?? null
    }
    // Never leave the previous player's profile visible during a transition.
    setPlayer(null)
    setUser(firebaseUser)
    setLoading(true)
    setError(null)
    setLostSession(null)
    try {
      const receipt = await deletionStorage.read()
      if (!current()) return
      setDeletion(receipt)
      if (receipt) {
        useGameStore.getState().resetSession()
        analyticsService.clearIdentity()
        return // A deleted account never silently becomes a new guest.
      }
      let savedMerge = await mergeStorage.read()
      if (!current()) return
      if (firebaseUser && !savedMerge && !proposalSource.current) {
        const identity = { uid: firebaseUser.uid, isAnonymous: firebaseUser.isAnonymous === true }
        lastSession.current = identity
        // Discovery may invalidate cached credentials. Persist continuity first
        // so its auth callback cannot silently create a replacement guest.
        await sessionStorage.write(identity)
        if (!current()) return
      }
      // Discover locks after reinstall or on another device. Creation is currently
      // enabled only in emulator builds, pending operational/native acceptance.
      if (!savedMerge && firebaseUser && useFirebaseEmulators && !proposalSource.current) savedMerge = await accountMergeService.discover(firebaseUser.uid)
      if (!current()) return
      setMerge(savedMerge)
      if (savedMerge || proposalSource.current) {
        useGameStore.getState().resetSession()
        analyticsService.clearIdentity()
        return
      }
      if (!firebaseUser) {
        const saved = await sessionStorage.read()
        if (!current()) return
        // A provider login may have finished while local storage was loading.
        if (getAuth().currentUser) { await load(getAuth().currentUser); return }
        const previous = lastSession.current || saved
        if (previous && !allowNewGuest) {
          setLostSession(previous)
          return
        }
        guestRequest.current ||= signInAnonymously(getAuth()).finally(() => { guestRequest.current = null })
        const result = await guestRequest.current
        if (current()) await load(result.user)
        return
      }
      const fetched = await gameService.ensurePlayerExists(firebaseUser.uid, "Player")
      if (!current()) return
      setPlayer(fetched)
      // Do not send provider names, email addresses, or display names to analytics.
      if (firebaseUser.isAnonymous) analyticsService.trackAnonymousSignIn(firebaseUser.uid)
      else analyticsService.identifyUser(firebaseUser.uid)
    } catch (failure) {
      const rejected = failure as { code?: string; details?: { reason?: string } } | null
      if (current() && firebaseUser && getAuth().currentUser === firebaseUser &&
        rejected?.code === "functions/unauthenticated" && rejected.details?.reason === "session-invalid") {
        try {
          // Discovery has already retried with a fresh token. Preserve the
          // continuity marker/outbox and let the auth listener open recovery.
          // This is invalidation, never the explicit-sign-out/new-guest path.
          await signOut(getAuth())
          if (current()) await load(getAuth().currentUser)
          return
        } catch { /* Failed local sign-out stays gated and can be retried. */ }
      }
      if (current()) { setError(sessionError); setPlayer(null) }
    } finally {
      if (current()) setLoading(false)
    }
  }, [])

  const afterSignOut = useCallback(async () => {
    if (!mounted.current || getAuth().currentUser) return
    await loadSession(null, true) // Explicit sign-out permits a new guest.
  }, [loadSession])
  const blockForMerge = useCallback(() => {
    generation.current++
    useGameStore.getState().resetSession()
    analyticsService.clearIdentity()
    setPlayer(null); setLostSession(null); setLoading(false); setError(null)
  }, [])
  const collision = useCallback(async (sourceUid: string, credential: AuthCredential) => {
    blockForMerge()
    proposalSource.current = sourceUid
    try {
      const identity = await openMergeIdentity(credential)
      if (!mounted.current || getAuth().currentUser?.uid !== sourceUid || identity.user.uid === sourceUid) {
        await identity.close()
        throw new Error("Your account changed.")
      }
      mergeIdentity.current = identity
      setMergeError(null)
      setMergeProposal({ sourceUid, accountLabel: identity.user.email || identity.user.displayName || "your saved Google account" })
    } catch (failure) {
      proposalSource.current = null
      await loadSession(getAuth().currentUser)
      throw failure
    }
  }, [blockForMerge, loadSession])
  const { isLoading: isSigningIn, authError: accountError, handleSignIn, handleSignOut, withDeletionVerification, verifyGoogleAccount } = useGoogleAuth(loadSession, afterSignOut, useFirebaseEmulators ? collision : undefined)
  const closeMergeIdentity = useCallback(async () => {
    const identity = mergeIdentity.current
    mergeIdentity.current = null
    await identity?.close()
  }, [])
  const mergeOperation = useCallback(async (operation: () => Promise<void>) => {
    if (mergeBusy.current || deletionBusy.current || isSigningIn) return
    mergeBusy.current = true; setIsMerging(true); setMergeError(null)
    try { await operation() }
    catch (failure) {
      const code = (failure as { code?: string }).code
      const reason = (failure as { details?: { reason?: string } }).details?.reason
      if (code === "functions/unauthenticated" || code?.startsWith("auth/") || reason === "reauthentication-required") {
        // Retrying a revoked/expired temporary session forever cannot recover.
        // Dispose it so the next player action verifies the provider again.
        await closeMergeIdentity().catch(() => undefined)
      }
      if (mounted.current) setMergeError(code === "account/verification-cancelled"
        ? "Verification cancelled. Your account operation is still saved."
        : "We couldn't finish this step. Retry with the same saved Google account. Your account operation is kept for recovery.")
    } finally {
      try {
        const receipt = await mergeStorage.read()
        if (mounted.current) { setMerge(receipt); if (receipt) blockForMerge() }
      } catch { if (mounted.current) { blockForMerge(); setError(sessionError) } }
      mergeBusy.current = false
      if (mounted.current) setIsMerging(false)
    }
  }, [isSigningIn, blockForMerge, closeMergeIdentity])
  const destination = useCallback(async (receipt: MergeReceipt) => {
    if (!mergeIdentity.current) await verifyGoogleAccount(async credential => {
      const identity = await openMergeIdentity(credential)
      if (!mounted.current || identity.user.uid !== receipt.targetUid) {
        await identity.close()
        throw new Error("Verify the same saved account.")
      }
      mergeIdentity.current = identity
    })
    if (!mergeIdentity.current || mergeIdentity.current.user.uid !== receipt.targetUid) throw new Error("Verify the same saved account.")
    return mergeIdentity.current
  }, [verifyGoogleAccount])
  const confirmMerge = useCallback(() => mergeOperation(async () => {
    if (!proposalSource.current || !mergeIdentity.current) return
    const receipt = await accountMergeService.prepare(proposalSource.current, mergeIdentity.current)
    blockForMerge(); setMerge(receipt); setMergeProposal(null); proposalSource.current = null
    setMerge(await accountMergeService.submit(receipt, mergeIdentity.current))
  }), [mergeOperation, blockForMerge])
  const continueMerge = useCallback(() => mergeOperation(async () => {
    let receipt = await mergeStorage.read()
    if (!receipt) return
    const identity = await destination(receipt)
    try { receipt = await accountMergeService.refresh(receipt, identity) }
    catch (failure) {
      if ((failure as { code?: string }).code !== "merge/not-found" || receipt.status !== "submitting") throw failure
      receipt = await accountMergeService.submit(receipt, identity)
    }
    if (receipt.status === "pending" || receipt.status === "review") receipt = await accountMergeService.resume(receipt, identity)
    setMerge(receipt)
  }), [mergeOperation, destination])
  const cancelMerge = useCallback(() => mergeOperation(async () => {
    const receipt = await mergeStorage.read()
    if (receipt) {
      const identity = getAuth().currentUser?.uid === receipt.sourceUid ? undefined : await destination(receipt)
      const result = await accountMergeService.cancel(receipt, identity)
      if (result.status !== "cancelled") throw new Error("This operation can no longer be cancelled.")
      await accountMergeService.dismissCancellation(result, identity)
    }
    await closeMergeIdentity()
    proposalSource.current = null; setMergeProposal(null); setMerge(null)
    await loadSession(getAuth().currentUser)
  }), [mergeOperation, destination, closeMergeIdentity, loadSession])
  const finishMerge = useCallback(() => mergeOperation(async () => {
    const receipt = await mergeStorage.read()
    if (!receipt) return
    await accountMergeService.finish(receipt, await destination(receipt))
    await closeMergeIdentity()
    setMerge(null)
    await loadSession(getAuth().currentUser)
  }), [mergeOperation, destination, closeMergeIdentity, loadSession])
  useEffect(() => {
    if (merge?.status !== "pending" || mergeError) return
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && mergeIdentity.current) void continueMerge()
    }, 15000)
    return () => clearInterval(timer)
  }, [merge?.status, mergeError, continueMerge])
  const retryAuthentication = useCallback(() => loadSession(getAuth().currentUser), [loadSession])
  const replaceLostSession = useCallback(async () => {
    if (!lostSession || merge || mergeProposal || isSigningIn || recoveryBusy.current || deletionBusy.current || getAuth().currentUser) return
    recoveryBusy.current = true
    try { await loadSession(null, true) }
    finally { recoveryBusy.current = false }
  }, [lostSession, merge, mergeProposal, isSigningIn, loadSession])

  const acceptDeletion = useCallback(async (receipt: DeletionReceipt) => {
    generation.current++
    useGameStore.getState().resetSession()
    analyticsService.clearIdentity()
    if (mounted.current) { setDeletion(receipt); setPlayer(null); setLostSession(null); setLoading(false); setError(null) }
    await accountDeletionService.clearLocal(receipt)
  }, [])

  const deletionOperation = useCallback(async (operation: () => Promise<void>) => {
    if (deletionBusy.current || mergeBusy.current || proposalSource.current) return
    deletionBusy.current = true
    setIsDeleting(true)
    setDeletionError(null)
    try { await operation() }
    catch (failure) {
      // Restore persisted intent even when the request/response or local cleanup failed.
      try {
        const receipt = await deletionStorage.read()
        if (receipt && mounted.current) { setDeletion(receipt); setPlayer(null); generation.current++; useGameStore.getState().resetSession() }
      } catch { /* Keep the current state; never treat a storage failure as completion. */ }
      if (mounted.current) {
        const code = (failure as { code?: string }).code
        const reason = (failure as { details?: { reason?: string } }).details?.reason
        setDeletionError(code === "account/verification-cancelled" ? "Verification cancelled. No new deletion request was sent."
          : reason === "reauthentication-required" || code === "auth/user-mismatch"
          ? "Verify the same Google account before retrying deletion."
          : "Deletion could not be confirmed or local cleanup is unfinished. Check your connection and retry. Your saved receipt will be kept.")
      }
    } finally { deletionBusy.current = false; if (mounted.current) setIsDeleting(false) }
  }, [])

  const handleDeleteAccount = useCallback(() => deletionOperation(async () => {
    let receipt = await deletionStorage.read()
    if (receipt) {
      receipt = await accountDeletionService.refresh(receipt)
      await acceptDeletion(receipt)
      if (receipt.status === "pending" || receipt.status === "complete" || receipt.status === "unknown") return
    }
    const uid = receipt?.uid || getAuth().currentUser?.uid
    if (!uid) throw new Error("Verify your account first.")
    await withDeletionVerification(uid, async () => {
      receipt = await accountDeletionService.prepare(uid)
      await acceptDeletion(receipt)
      receipt = await accountDeletionService.submit(receipt)
      await acceptDeletion(receipt)
    })
  }), [deletionOperation, withDeletionVerification, acceptDeletion])

  const refreshDeletion = useCallback(() => deletionOperation(async () => {
    const receipt = await deletionStorage.read()
    if (!receipt) return
    await acceptDeletion(await accountDeletionService.refresh(receipt))
  }), [deletionOperation, acceptDeletion])

  const startNewGuest = useCallback(() => deletionOperation(async () => {
    const receipt = await deletionStorage.read()
    if (!receipt || receipt.status !== "complete") throw new Error("Confirm deletion before starting again.")
    await accountDeletionService.clearLocal(receipt)
    if (getAuth().currentUser) throw new Error("An account is still signed in. Retry local cleanup before starting again.")
    await deletionStorage.clear()
    setDeletion(null)
    lastSession.current = null
    await loadSession(null, true)
  }), [deletionOperation, loadSession])

  useEffect(() => {
    if (!deletion || deletion.status === "unknown" || deletion.status === "complete") return
    void refreshDeletion()
    const timer = setInterval(() => { if (AppState.currentState === "active") void refreshDeletion() }, 30000)
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refreshDeletion() })
    return () => { clearInterval(timer); subscription.remove() }
  }, [deletion?.uid, deletion?.status, refreshDeletion])

  useEffect(() => {
    mounted.current = true
    const unsubscribe = onAuthStateChanged(getAuth(), loadSession, () => {
      if (!mounted.current) return
      generation.current++
      useGameStore.getState().resetSession()
      analyticsService.clearIdentity()
      setPlayer(null)
      setUser(null)
      setLostSession(null)
      setError(sessionError)
      setLoading(false)
    })
    return () => { mounted.current = false; generation.current++; unsubscribe(); void closeMergeIdentity().catch(() => undefined) }
  }, [loadSession])

  return <AuthContext.Provider value={{ player, user, loading, error, accountError, retryAuthentication, handleSignIn, handleSignOut, isSigningIn, deletion, deletionError, isDeleting, handleDeleteAccount, refreshDeletion, startNewGuest, lostSession, replaceLostSession, merge, mergeProposal, mergeError, isMerging, confirmMerge, continueMerge, cancelMerge, finishMerge }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
