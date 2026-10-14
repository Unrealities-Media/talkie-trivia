import React, { useEffect, useState } from "react"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import { gameService } from "../services/gameService"
import { useGameStore } from "../state/gameStore"
import PlayerStatsContainer from "./playerStats"
import LoadingIndicator from "./loadingIndicator"
import ErrorMessage from "./errorMessage"
import { Typography } from "./ui/typography"

/** Account reads must not depend on availability of today's editorial content. */
export default function AccountStats({ player }: { player: Player }) {
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
  return <PlayerStatsContainer player={player} playerStats={result.stats} />
}
