import React from "react"
import { Text, View, StyleSheet, useWindowDimensions, PixelRatio } from "react-native"
import { useGameStore } from "../state/gameStore"
import { challengeDay } from "../utils/resultSummary"
import { premiere } from "./premiereStage"
import { useTheme } from "../contexts/themeContext"

export default function PremiereMasthead() {
  const { width } = useWindowDimensions()
  const { colors } = useTheme()
  const game = useGameStore(state => state.playerGame)
  const isResult = useGameStore(state => state.gameStatus === "gameOver" || state.gameStatus === "revealing")
  const day = game?.id ? challengeDay(game) : null
  const date = day ? new Date(day + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).toUpperCase() : "A NEW MYSTERY"
  return <View style={styles.header}>
    <View style={styles.brand}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontSize: PixelRatio.roundToNearestPixel(Math.min(34, width * 0.074)) }]}>TALKIE TRIVIA</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{day ? `DAILY / ${date}` : date}</Text>
    </View>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.aside}>
      <Text style={[styles.note, { color: colors.textSecondary }]}>{isResult ? "GREAT\nMOVIES\nLIVE ON" : "SAME\nSTORIES\nA BRIGHTER\nTOMORROW"}</Text>
      <View style={styles.rule} />
    </View>
  </View>
}

const styles = StyleSheet.create({
  header: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 25, paddingTop: 22, paddingBottom: 22 },
  brand: { flexShrink: 1 },
  title: { color: premiere.cream, fontFamily: "PremiereDisplay", fontSize: 32, lineHeight: 42, letterSpacing: 0.5 },
  date: { fontFamily: "PremiereSans", color: premiere.muted, fontSize: 9, letterSpacing: 4.5, textAlign: "center", marginTop: 2 },
  aside: { paddingTop: 5, marginLeft: 12 },
  note: { fontFamily: "PremiereSans", color: premiere.muted, fontSize: 6, lineHeight: 12, letterSpacing: 2.4 },
  rule: { width: 17, height: 1, backgroundColor: "#AF9B84", marginTop: 12 },
})
