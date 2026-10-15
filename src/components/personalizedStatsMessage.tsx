import React from "react"
import { View } from "react-native"
import { useGameStore } from "../state/gameStore"
import { savedScore } from "../utils/resultSummary"
import { Typography } from "./ui/typography"

export default function PersonalizedStatsMessage() {
  const stats = useGameStore(state => state.playerStats)
  const game = useGameStore(state => state.playerGame)
  // Use the same acknowledged account snapshot as the result. No second history
  // request, stale account response, or claim that seven games mean seven days.
  if (!stats || !game || !game.playerID || stats.id !== game.playerID ||
    savedScore(game) === null || !Number.isSafeInteger(stats.games) || stats.games < 1 ||
    !Array.isArray(stats.wins) || stats.wins.some(value => !Number.isSafeInteger(value) || value < 0)) return null
  const wins = stats.wins.reduce((total, value) => total + value, 0)
  if (wins > stats.games) return null
  return <View style={{ width: "100%", padding: 16, gap: 8 }}>
    {game.correctAnswer && game.guesses.length === 1 && <Typography>Found it on your first guess!</Typography>}
    <Typography>You have won {wins} of {stats.games} completed daily {stats.games === 1 ? "game" : "games"}.</Typography>
    <Typography>Try another difficulty in Daily challenges above, or view your saved games in Profile. Five new movies arrive at 00:00 UTC.</Typography>
  </View>
}
