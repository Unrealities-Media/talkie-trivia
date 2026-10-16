import React from "react"
import { Text, View, StyleSheet } from "react-native"
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"
import { useGameStore } from "../state/gameStore"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

// Only earned categories may appear on the screen. Having the full movie in
// memory must never reveal a hint that the difficulty rules still conceal.
export default function ProjectionHints() {
  const reduced = usePremiereMotion()
  const game = useGameStore(state => state.playerGame)
  const difficulty = useGameStore(state => state.difficulty)
  const strategy = DIFFICULTY_MODES[difficulty]?.hintStrategy
  if (strategy === "NONE_DISABLED" || strategy === "EXTREME_CHALLENGE") return null
  const allRevealed = strategy === "ALL_REVEALED" || strategy === "HINTS_ONLY_REVEALED"
  const hints = (game?.triviaItem?.hints || []).filter(hint =>
    ["genre", "decade"].includes(hint.type) && (allRevealed || game.hintsUsed?.[hint.type])
  )
  if (!hints.length) return null
  return <View style={styles.row} accessibilityLiveRegion="polite">
    {hints.map(hint => <Animated.View key={hint.type} entering={FadeInDown.duration(350).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={styles.chip}>
      <Text accessibilityLabel={`${hint.label}: ${String(hint.value)}`} style={styles.text}>{String(hint.value)}</Text>
    </Animated.View>)}
  </View>
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  chip: { backgroundColor: "#DED6BD", borderRadius: 24, paddingHorizontal: 23, paddingVertical: 5, maxWidth: "100%" },
  text: { fontFamily: "PremiereSans", fontSize: 14, color: "#14232A", textAlign: "center" },
})
