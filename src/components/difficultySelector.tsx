import React, { useState } from "react"
import { View, Pressable } from "react-native"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useAuth } from "../contexts/authContext"
import { DifficultyLevel, DIFFICULTY_MODES } from "../config/difficulty"
import { useThemeTokens } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import ConfirmationModal from "./confirmationModal"

const DifficultySelector = () => {
  const { player } = useAuth()
  const { colors } = useThemeTokens()
  const difficulty = useGameStore(state => state.nextDifficulty)
  const setDifficulty = useGameStore(state => state.setDifficulty)
  const statuses = useGameStore(state => state.dailyChallenges)
  const saving = useGameStore(state => state.syncStatus)
  const loading = useGameStore(state => state.loading)
  const gameUid = useGameStore(state => state.playerGame?.playerID)
  const initializeGame = useGameStore(state => state.initializeGame)
  const disabled = loading || (saving !== undefined && saving !== "idle")
  const [pending, setPending] = useState<DifficultyLevel | null>(null)
  const start = (value: DifficultyLevel) => {
    if (!player || disabled) return
    hapticsService.medium()
    setDifficulty(value)
    if (!gameUid && !disabled) void initializeGame(player, value)
  }
  const handleSelect = (value: DifficultyLevel) => {
    if (!player || disabled) return
    const status = statuses?.[value]
    if (status === "Won" || status === "Lost" || status === "In progress") start(value)
    else setPending(value)
  }
  const completed = Object.values(statuses ?? {}).filter(status => status === "Won" || status === "Lost").length
  return <View style={{ width: "100%", gap: 6 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Typography style={{ fontSize: 12, color: colors.textSecondary }}>Daily challenges</Typography>
      <Typography accessibilityLabel={`${completed} of 5 daily challenges completed`} style={{ fontSize: 12, color: colors.textSecondary }}>{completed} / 5 complete</Typography>
    </View>
    <View style={{ flexDirection: "row", gap: 4 }}>
      {(Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]).map(value => {
        const option = DIFFICULTY_MODES[value]
        const selected = difficulty === value
        const status = statuses?.[value]
        const mark = status === "Won" ? " ✓" : status === "Lost" ? " —" : status === "In progress" ? " ·" : ""
        return <Pressable key={value} onPress={() => handleSelect(value)} disabled={disabled}
          accessibilityRole="button" accessibilityState={{ selected, disabled }}
          accessibilityLabel={`Play ${option.label}. ${status ?? "Progress not loaded"}. ${option.description}`}
          style={({ pressed }) => ({ flex: 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: 2, justifyContent: "center", borderRadius: 6, backgroundColor: selected ? colors.primary : colors.surface, opacity: pressed || disabled ? 0.7 : 1 })}>
          <Typography style={{ fontSize: 12, lineHeight: 16, textAlign: "center", color: selected ? colors.onAccent : colors.textPrimary }}>{option.label}{mark}</Typography>
        </Pressable>
      })}
    </View>
    {completed === 5 && <Typography>All five completed today!</Typography>}
    {saving === "pending" && <Typography>Retry your pending move before switching challenges.</Typography>}
    <ConfirmationModal isVisible={pending !== null} title={pending ? `${DIFFICULTY_MODES[pending].label} · today's movie` : "Today's movie"}
      message={pending ? `${DIFFICULTY_MODES[pending].description} Your progress is saved, so you can come back anytime today.` : ""}
      confirmText="Start challenge" cancelText="Keep browsing" onCancel={() => setPending(null)}
      onConfirm={() => { const value = pending; setPending(null); if (value) start(value) }} />
  </View>
}
export default DifficultySelector
