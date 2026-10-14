import React, { useState } from "react"
import { ScrollView, View, Text } from "react-native"
import GameHistory from "../../components/gameHistory"
import HistoryDetailModal from "../../components/historyDetailModal"
import { GameHistoryEntry } from "../../models/gameHistory"
import { useTheme } from "../../contexts/themeContext"

export default function ArchiveScreen() {
  const { colors } = useTheme()
  const [selected, setSelected] = useState<GameHistoryEntry | null>(null)
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ alignItems: "center", padding: 20 }}>
    <View style={{ width: "100%", maxWidth: 460 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "PremiereDisplay", fontSize: 40, color: colors.textPrimary, marginVertical: 24 }}>The archive</Text>
      <Text style={{ fontFamily: "PremiereSans", color: colors.textSecondary, letterSpacing: 2, fontSize: 10, marginBottom: 24 }}>YOUR PREVIOUS SCREENINGS</Text>
      <GameHistory onHistoryItemPress={setSelected} />
      <HistoryDetailModal historyItem={selected} onClose={() => setSelected(null)} />
    </View>
  </ScrollView>
}
