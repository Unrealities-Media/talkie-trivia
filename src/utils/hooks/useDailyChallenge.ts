import { useEffect } from "react"
import { AppState } from "react-native"
import { useGameStore } from "../../state/gameStore"
import Player from "../../models/player"

/** All timing decisions are rechecked against the server on foreground/reconnect. */
export function useDailyChallenge(player: Player | null, connected: boolean | null) {
  const uid = player?.id
  useEffect(() => {
    if (!uid || connected === false) return
    let active = AppState.currentState !== "background" && AppState.currentState !== "inactive"
    let lastAttempt = -Infinity
    let requested = true
    const refresh = () => {
      const state = useGameStore.getState()
      if (!active || state.syncStatus === "saving") return
      requested = false
      lastAttempt = performance.now()
      void state.initializeGame({ id: uid, name: "Player" })
    }
    refresh()
    const subscription = AppState.addEventListener("change", next => {
      const returning = !active && next === "active"
      active = next === "active"
      if (returning) { requested = true; refresh() }
    })
    const timer = setInterval(() => {
      const state = useGameStore.getState()
      if (!active || state.loading || state.syncStatus === "saving") return
      const due = state.resetDeadline === null || performance.now() >= state.resetDeadline
      // Missing content/connection errors retry at most once per minute.
      if (requested || ((due || state.error) && performance.now() - lastAttempt >= (state.error ? 60000 : 1000))) refresh()
    }, 1000)
    return () => { clearInterval(timer); subscription.remove() }
  }, [uid, connected])
}
