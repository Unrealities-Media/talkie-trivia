import React, { useEffect, useState } from "react"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import { gameService } from "../services/gameService"
import { useGameStore } from "../state/gameStore"
import PlayerStatsContainer from "./playerStats"
import LoadingIndicator from "./loadingIndicator"
import ErrorMessage from "./errorMessage"
import { Typography } from "./ui/typography"
import { View, Text, AppState } from "react-native"
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"
import { useTheme } from "../contexts/themeContext"
import { useCountUp } from "../utils/hooks/useCountUp"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

/** A cream admission stub with punched notches; drops in on arrival. */
function TicketStub({ value, label, index, hot }: { value: string; label: string; index: number; hot?: boolean }) {
  const { colors } = useTheme()
  const reduced = usePremiereMotion()
  const notch = { position: "absolute" as const, top: "58%" as const, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.background }
  return <Animated.View entering={FadeInDown.springify().damping(12).delay(250 + index * 120).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={{ flex: 1, minWidth: 0 }}>
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ backgroundColor: "#F3E1C1", borderRadius: 6, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 6, alignItems: "center", transform: [{ rotate: `${[-2, 1, -1][index % 3]}deg` }] }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: "PremiereDisplay-Bold", fontSize: 25, lineHeight: 30, color: hot ? "#B8382C" : "#2A1D12", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <View style={{ alignSelf: "stretch", borderTopWidth: 1.5, borderStyle: "dashed", borderColor: "#2A1D1240", marginTop: 12, marginBottom: 7 }} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: "PremiereSans", fontSize: 9, letterSpacing: 1.6, color: "#6B5236" }}>{label.toUpperCase()}</Text>
      <View style={[notch, { left: -6 }]} />
      <View style={[notch, { right: -6 }]} />
    </View>
  </Animated.View>
}

function TicketStubs({ stats }: { stats: PlayerStats }) {
  const points = useCountUp(stats.allTimeScore, { delay: 450, duration: 1200 })
  return <View style={{ flexDirection: "row", gap: 8 }}>
    <TicketStub index={0} value={points.toLocaleString()} label="Total points" />
    <TicketStub index={1} value={`${stats.wins.reduce((sum, count) => sum + count, 0)} / ${stats.games}`} label="Movies solved" />
    <TicketStub index={2} hot={stats.currentStreak > 0} value={`${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`} label="Current streak" />
  </View>
}

/** Account reads must not depend on availability of today's editorial content. */
export default function AccountStats({ player, compact = false }: { player: Player; compact?: boolean }) {
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
  }, [player.id, attempt, confirmed?.games, confirmed?.allTimeScore])
  useEffect(() => {
    const serverNow = result?.stats?.serverNow
    if (!serverNow) return
    const time = Date.parse(serverNow)
    const timer = setTimeout(() => setAttempt(value => value + 1), 86400000 - (time % 86400000) + 100)
    const listener = AppState.addEventListener("change", state => { if (state === "active") setAttempt(value => value + 1) })
    return () => { clearTimeout(timer); listener.remove() }
  }, [result])
  if (!result || result.uid !== player.id) return <LoadingIndicator message="Loading statistics…" />
  if (result.error) return <ErrorMessage message="Could not load your statistics." onRetry={() => setAttempt(value => value + 1)} />
  if (!result.stats) return <Typography>No saved statistics yet.</Typography>
  if (compact) return <TicketStubs stats={result.stats} />
  return <PlayerStatsContainer player={player} playerStats={result.stats} />
}
