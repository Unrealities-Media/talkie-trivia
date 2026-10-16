import React from "react"
import { Platform } from "react-native"
import { useAuth } from "../contexts/authContext"
import { useGameStore } from "../state/gameStore"
import { DIFFICULTY_MODES, DifficultyLevel } from "../config/difficulty"
import { Button } from "./ui/button"

export default function NextChallenge() {
  const { player, deletion, merge, mergeProposal, lostSession } = useAuth()
  const game = useGameStore(s => s.playerGame)
  const statuses = useGameStore(s => s.dailyChallenges)
  const deadline = useGameStore(s => s.resetDeadline)
  const loading = useGameStore(s => s.loading)
  const syncStatus = useGameStore(s => s.syncStatus)
  const setDifficulty = useGameStore(s => s.setDifficulty)
  const levels = Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]
  const index = levels.indexOf(game.difficulty)
  const ordered = [...levels.slice(index + 1), ...levels.slice(0, index)]
  const next = ordered.find(level => statuses[level] === "In progress")
    ?? ordered.find(level => statuses[level] === "Not started")
  if (!next || !player || player.id !== game.playerID || deletion || merge || mergeProposal || lostSession
    || deadline === null || performance.now() >= deadline) return null
  const disabled = loading || syncStatus !== "idle"
  return <Button title={`${statuses[next] === "In progress" ? "Continue" : "Next challenge:"} ${DIFFICULTY_MODES[next].label}`}
    disabled={disabled} onPress={event => {
      // A tab can remain open across the daily reset between render and click.
      if (!disabled && performance.now() < deadline) {
        if (Platform.OS === "web" && (event.nativeEvent as unknown as MouseEvent)?.detail === 0) {
          // This button disappears during loading; the daily-game region stays.
          const button = event.currentTarget as unknown as HTMLElement
          button.closest<HTMLElement>('[data-daily-game]')?.focus()
        }
        setDifficulty(next)
      }
    }} />
}
