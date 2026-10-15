import React from "react"
import { View } from "react-native"
import { useGameStore } from "../state/gameStore"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { Typography } from "./ui/typography"

// Each difficulty is an independent daily challenge.
export default function GameDifficultyToggle() {
  const difficulty = useGameStore(state => state.playerGame.difficulty)
  const label = DIFFICULTY_MODES[difficulty]?.label || "Medium"
  return <View accessible accessibilityLabel={`Current challenge: ${label}. Switch challenges above; progress is saved separately.`}>
    <Typography variant="caption">{label} · daily challenge</Typography>
  </View>
}
