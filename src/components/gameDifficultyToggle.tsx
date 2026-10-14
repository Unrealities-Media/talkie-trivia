import React from "react"
import { View } from "react-native"
import { useGameStore } from "../state/gameStore"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { Typography } from "./ui/typography"

// Difficulty belongs to the saved challenge. Preferences apply to the next one.
export default function GameDifficultyToggle() {
  const difficulty = useGameStore(state => state.playerGame.difficulty)
  const label = DIFFICULTY_MODES[difficulty]?.label || "Medium"
  return <View accessible accessibilityLabel={`Today's difficulty: ${label}. Change your next challenge's difficulty in Profile.`}>
    <Typography>{label} · locked for today</Typography>
  </View>
}
