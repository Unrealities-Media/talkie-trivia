import React, { useEffect, useState } from "react"
import { ScrollView, View, Text } from "react-native"
import GameHistory from "../../components/gameHistory"
import HistoryDetailModal from "../../components/historyDetailModal"
import { GameHistoryEntry } from "../../models/gameHistory"
import { useTheme } from "../../contexts/themeContext"
import { useAuth } from "../../contexts/authContext"
import { LinearGradient } from "expo-linear-gradient"

export default function ArchiveScreen() {
  const { colors } = useTheme()
  const { player } = useAuth()
  const [selected, setSelected] = useState<{ uid: string; item: GameHistoryEntry } | null>(null)
  useEffect(() => { setSelected(null) }, [player?.id])
  return <LinearGradient colors={[colors.background, colors.backgroundLight]} style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={{ alignItems: "center", padding: 20, paddingTop: 30, paddingBottom: 32, flexGrow: 1 }}>
    <View style={{ width: "100%", maxWidth: 420 }}>
      <View style={{ paddingBottom: 20, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text accessibilityRole="header" style={{ fontFamily: "PremiereDisplay", fontSize: 40, lineHeight: 48, color: colors.textPrimary }}>The archive</Text>
        <Text style={{ fontFamily: "PremiereSans", color: colors.textSecondary, fontSize: 13, lineHeight: 21, marginTop: 8 }}>Your previous screenings, all in one place.</Text>
      </View>
      <GameHistory onHistoryItemPress={item => { if (player) setSelected({ uid: player.id, item }) }} />
      <HistoryDetailModal key={player?.id ?? "signed-out"} historyItem={selected?.uid === player?.id ? selected?.item ?? null : null} onClose={() => setSelected(null)} />
    </View>
  </ScrollView>
  </LinearGradient>
}
