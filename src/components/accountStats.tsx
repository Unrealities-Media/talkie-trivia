import React, { useEffect, useState } from "react"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import { gameService } from "../services/gameService"
import { useGameStore } from "../state/gameStore"
import PlayerStatsContainer from "./playerStats"
import LoadingIndicator from "./loadingIndicator"
import ErrorMessage from "./errorMessage"
import { Typography } from "./ui/typography"
import { View, Text } from "react-native"
import { useTheme } from "../contexts/themeContext"

/** Account reads must not depend on availability of today's editorial content. */
export default function AccountStats({ player, compact = false }: { player: Player; compact?: boolean }) {
  const { colors } = useTheme()
  const confirmed = useGameStore(state => state.playerStats)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ uid: string; stats: PlayerStats | null; error: boolean } | null>(null)
  useEffect(() => {
    let active = true
    setResult(null)
    gameService.fetchPlayerStats(player.id).then(
      stats => { if (active) setResult({ uid: player.id, stats, error: false }) },
      () => { if (active) setResult({ uid: player.id, stats: null, error: true }) },
    )
    return () => { active = false }
  }, [player.id, attempt, confirmed])
  if (!result || result.uid !== player.id) return <LoadingIndicator message="Loading statistics…" />
  if (result.error) return <ErrorMessage message="Could not load your statistics." onRetry={() => setAttempt(value => value + 1)} />
  if (!result.stats) return <Typography>No saved statistics yet.</Typography>
  if (compact) {
    const stats = result.stats
    const metrics = [
      [stats.allTimeScore.toLocaleString(), "Total points"],
      [`${stats.wins.reduce((sum, count) => sum + count, 0)} / ${stats.games}`, "Movies solved"],
      [`${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`, "Current streak"],
    ]
    return <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 14 }}>
      {metrics.map(([value, label], index) => <View key={label} style={{ flex: 1, paddingHorizontal: index === 0 ? 0 : 10, borderLeftWidth: index ? 1 : 0, borderColor: colors.border }}>
        <Text style={{ fontFamily: "PremiereDisplay", fontSize: 29, color: colors.textPrimary }}>{value}</Text>
        <Text style={{ fontFamily: "PremiereSans", fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{label}</Text>
      </View>)}
    </View>
  }
  return <PlayerStatsContainer player={player} playerStats={result.stats} />
}
