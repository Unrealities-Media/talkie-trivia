import React, { useState, useEffect } from "react"
import { useAuth } from "../contexts/authContext"
import { GameHistoryEntry } from "../models/gameHistory"
import GameHistory from "./gameHistory"
import HistoryDetailModal from "./historyDetailModal"

export default function ProfileHistory({ compact = false }: { compact?: boolean }) {
  const { player, user } = useAuth()
  const [selected, setSelected] = useState<{ uid: string; item: GameHistoryEntry } | null>(null)
  useEffect(() => { setSelected(null) }, [player?.id])
  if (!player || !user) return null
  return <>
    <GameHistory compact={compact} onHistoryItemPress={item => setSelected({ uid: player.id, item })} />
    <HistoryDetailModal historyItem={selected?.uid === player.id ? selected.item : null} onClose={() => setSelected(null)} />
  </>
}
