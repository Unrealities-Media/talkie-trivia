import React, { lazy, Suspense, useCallback, useEffect, useRef } from "react"
import { GestureResponderEvent, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import LoadingIndicator from "../../components/loadingIndicator"
import { useTheme } from "../../contexts/themeContext"
import { useGameStore } from "../../state/gameStore"
import { useStyles, Theme } from "../../utils/hooks/useStyles"
import { u } from "../../styles/utils"
import { useAuth } from "../../contexts/authContext"
import { useNetwork } from "../../contexts/networkContext"
import ErrorMessage from "../../components/errorMessage"
import AccountDeletion from "../../components/accountDeletion"
import SessionRecovery from "../../components/sessionRecovery"
import AccountMerge from "../../components/accountMerge"
import DifficultySelector from "../../components/difficultySelector"
import PremiereMasthead from "../../components/premiereMasthead"

const GameplayContainer = lazy(
  () => import("../../components/gameplayContainer")
)
const ConfettiCelebration = lazy(
  () => import("../../components/confettiCelebration")
)
const FlashMessages = lazy(() => import("../../components/flashMessages"))
const GameLayout = ({ children, showDifficulty }: { children: React.ReactNode; showDifficulty: boolean }) => {
  const styles = useStyles(themedStyles)
  const insets = useSafeAreaInsets()
  const scroll = useRef<ScrollView>(null)
  const gameStatus = useGameStore(state => state.gameStatus)
  const gameId = useGameStore(state => state.playerGame?.id)
  useEffect(() => {
    Keyboard.dismiss()
    // New challenges and results start at their clue/masthead, even when the
    // previous movie's synopsis or guess history was scrolled far down.
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }))
    return () => cancelAnimationFrame(frame)
  }, [gameId, gameStatus])
  const pendingFrame = useRef<number | null>(null)
  const revealSearch = useCallback(() => {
    if (Platform.OS !== "android" || !Keyboard.isVisible() || pendingFrame.current !== null) return
    // Keep the focused search field near the top of the resized viewport, leaving
    // room for results below it. Merely revealing the field hides every result
    // behind the keyboard at large text sizes.
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null
      const input = TextInput.State.currentlyFocusedInput()
      const viewport = scroll.current?.getNativeScrollRef()
      if (!input || !viewport || !Keyboard.isVisible()) return
      // Relative measurement only succeeds for this screen's descendants;
      // an input focused in another mounted tab must not move this screen.
      input.measureLayout(viewport,
        (_x, inputY) => {
          if (TextInput.State.currentlyFocusedInput() !== input || !Keyboard.isVisible()) return
          scroll.current?.scrollTo({ y: Math.max(0, inputY - 8), animated: false })
        },
        () => undefined,
      )
    })
  }, [])
  useEffect(() => {
    if (Platform.OS !== "android") return
    const subscription = Keyboard.addListener("keyboardDidShow", revealSearch)
    return () => {
      subscription.remove()
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current)
    }
  }, [revealSearch])
  return (
    <KeyboardAvoidingView
      style={u.flex}
      enabled={Platform.OS === "android"}
      behavior="height"
      keyboardVerticalOffset={insets.top}
    >
    <ScrollView
      ref={scroll}
      onLayout={revealSearch}
      onContentSizeChange={revealSearch}
      contentContainerStyle={styles.scrollContentContainer}
      style={u.flex}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.headerContainer}>
        <PremiereMasthead reward={gameStatus === "gameOver" || gameStatus === "revealing"} />
      </View>
      {showDifficulty && <View style={[styles.headerContainer, { paddingHorizontal: 20, paddingBottom: 12 }]}><DifficultySelector /></View>}
      {children}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const GameScreen = () => {
  const showConfetti = useGameStore((state) => state.showConfetti)
  const handleConfettiStop = useGameStore((state) => state.handleConfettiStop)
  const flashMessage = useGameStore((state) => state.flashMessage)
  const { colors } = useTheme()
  const { player, deletion, merge, mergeProposal, lostSession, loading: authLoading, error: authError, retryAuthentication } = useAuth()
  const { isNetworkConnected, refreshNetwork } = useNetwork()
  const loading = useGameStore(state => state.loading)
  const error = useGameStore(state => state.error)
  const initializeGame = useGameStore(state => state.initializeGame)
  const hasGame = useGameStore(state => Boolean(state.playerGame.id))
  const gameRegion = useRef<HTMLDivElement>(null)
  const retry = async (event: GestureResponderEvent) => {
    // Retry unmounts while loading. Keep keyboard navigation at the game,
    // across both another error and a successful load, without an async jump.
    if (Platform.OS === "web" && (event.nativeEvent as unknown as MouseEvent)?.detail === 0) {
      gameRegion.current?.focus()
    }
    if (await refreshNetwork() === false) return
    if (authError || !player) await retryAuthentication()
    else await initializeGame(player)
  }
  let content: React.ReactNode
  if (deletion) content = <AccountDeletion />
  else if (merge || mergeProposal) content = <AccountMerge />
  else if (isNetworkConnected === false) content = <ErrorMessage message="You’re offline. Connect to load and save your daily game." onRetry={retry} />
  else if (authLoading) content = <LoadingIndicator message="Opening your player account…" />
  else if (lostSession) content = <SessionRecovery />
  else if (authError || !player) content = <ErrorMessage message={authError || "Your player account could not be opened."} onRetry={retry} />
  else if (error) content = <ErrorMessage message={error} onRetry={retry} />
  else if (loading || !hasGame) content = <LoadingIndicator message="Loading the daily movie…" />
  else content = <Suspense fallback={<LoadingIndicator />}><GameplayContainer /></Suspense>

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundLight]}
      style={u.flex}
    >
      <GameLayout showDifficulty={Boolean(player && !deletion && !merge && !mergeProposal && !lostSession && !authLoading && !authError && isNetworkConnected !== false)}>
        {Platform.OS === "web"
          ? <div ref={gameRegion} role="group" aria-label="Daily game" tabIndex={-1}
              style={{ width: "100%", flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {content}
            </div>
          : content}
      </GameLayout>
      <Suspense fallback={null}>
        <FlashMessages message={flashMessage} />
        <ConfettiCelebration
          startConfetti={showConfetti}
          onConfettiStop={handleConfettiStop}
        />
      </Suspense>
    </LinearGradient>
  )
}

interface GameScreenStyles {
  scrollContentContainer: ViewStyle
  headerContainer: ViewStyle
}

const themedStyles = (theme: Theme): GameScreenStyles => ({
  scrollContentContainer: {
    paddingTop: 0,
    paddingBottom: theme.spacing.extraLarge,
    alignItems: "center",
    flexGrow: 1,
  },
  headerContainer: {
    alignItems: "stretch",
    width: "100%",
    maxWidth: 460,
    paddingHorizontal: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
    borderBottomColor: theme.colors.border,
    zIndex: 1,
  },
})

export default GameScreen
