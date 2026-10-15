import React, { useEffect, useRef } from "react"
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useGameStore } from "../state/gameStore"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { useHintLogic } from "../utils/hooks/useHintLogic"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"
import { useTheme } from "../contexts/themeContext"
import { HintType } from "../models/game"

const seats: { type: HintType; label: string }[] = [
  { type: "genre", label: "Genre" }, { type: "decade", label: "Decade" },
  { type: "director", label: "Director" }, { type: "actors", label: "Actor" },
]

function Seat({ label, value, revealed, gameKey, onPress, hint }: {
  label: string; value: string; revealed: boolean; gameKey: string;
  onPress?: () => void; hint: string;
}) {
  const reduced = usePremiereMotion()
  const { height, fontScale } = useWindowDimensions()
  const previous = useRef({ gameKey, revealed })
  const glow = useSharedValue(1)
  useEffect(() => {
    const newlyRevealed = previous.current.gameKey === gameKey && !previous.current.revealed && revealed
    previous.current = { gameKey, revealed }
    cancelAnimation(glow)
    glow.value = newlyRevealed && !reduced ? 0 : 1
    if (newlyRevealed && !reduced) glow.value = withTiming(1, { duration: 450 })
    return () => cancelAnimation(glow)
  }, [gameKey, revealed, reduced, glow])
  const revealStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.65, transform: [{ translateY: (1 - glow.value) * 4 }] }))
  return <View style={[styles.seat, { height: (height < 650 ? 78 : 96) * Math.max(1, fontScale) }]}>
    <Image source={require("../../assets/premiere/seat-brass.png")} style={StyleSheet.absoluteFill} contentFit="fill" accessible={false} />
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label}: ${value}`} accessibilityHint={hint}
      style={({ pressed }) => [styles.plaqueEdge, { opacity: pressed ? 0.8 : 1 }]}>
      <View style={styles.plaque}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Animated.View style={revealStyle} accessibilityLiveRegion="polite">
          <Text style={[styles.value, !revealed && styles.unrevealed]}>{value}</Text>
        </Animated.View>
      </View>
    </Pressable>
  </View>
}

export default function SeatHints() {
  const { colors } = useTheme()
  const { height } = useWindowDimensions()
  const game = useGameStore(state => state.playerGame)
  const difficulty = useGameStore(state => state.difficulty)
  const remaining = useGameStore(state => state.playerStats?.hintsAvailable ?? 0)
  const { getHintText, hintStatuses, handleHintSelection } = useHintLogic()
  const strategy = DIFFICULTY_MODES[difficulty].hintStrategy
  const reserved = strategy === "NONE_DISABLED" || strategy === "EXTREME_CHALLENGE"
  const all = strategy === "ALL_REVEALED" || strategy === "HINTS_ONLY_REVEALED"
  const spend = strategy === "USER_SPEND"
  const gameKey = `${game.playerID}:${game.id}`
  if (reserved) return null
  return <View style={styles.container}>
    <Image source={require("../../assets/premiere/theatre.png")} style={styles.theatre} contentFit="cover" accessible={false} />
    <View style={styles.rows}>
      {[seats.slice(0, 2), seats.slice(2)].map((row, index) => <View key={index} style={[styles.row, index === 1 && { marginTop: height < 650 ? -18 : -24 }]}>
        {row.map(({ type, label }) => {
          // Never render concealed values, even as accessibility text.
          const revealed = !reserved && (all || Boolean(game.hintsUsed?.[type]))
          const available = spend && !revealed && hintStatuses[type] === "available"
          const value = revealed ? getHintText(type) : reserved ? "Reserved" : spend ? remaining > 0 ? "Reveal · −50 pts" : "Reserved" : "Awaiting match"
          const hint = reserved ? "No hints on this difficulty." : available ? `Use one of ${remaining} hints. Subtracts 50 points from a winning score.` : "Matching guesses reveal this hint."
          return <Seat key={type} label={label} value={value} revealed={revealed} gameKey={gameKey}
            hint={hint} onPress={available ? () => handleHintSelection(type) : undefined} />
        })}
      </View>)}
    </View>
    <Text style={[styles.note, { color: colors.textSecondary }]}>{reserved ? "Reserved · no hints on this difficulty" : spend ? `${remaining} hints left · tap a plaque to reveal` : strategy === "IMPLICIT_FEEDBACK" ? "Match a category to reveal its plaque" : "Your hints · front-row seats"}</Text>
  </View>
}

const styles = StyleSheet.create({
  container: { width: "100%", paddingTop: 6, marginTop: -3 },
  theatre: { position: "absolute", top: 0, left: 0, right: 0, height: 90, opacity: 0.85 },
  rows: { gap: 0 },
  row: { flexDirection: "row", gap: 2 },
  seat: { flex: 1 },
  plaqueEdge: { position: "absolute", top: "50%", transform: [{ translateY: -22 }], left: "19%", right: "19%", minHeight: 44, justifyContent: "center" },
  plaque: { justifyContent: "center", paddingVertical: 3, paddingHorizontal: 2, backgroundColor: "#DBC38F", borderWidth: 1, borderColor: "#9C7C45", borderRadius: 2 },
  label: { fontFamily: "PremiereSans", fontSize: 8, lineHeight: 10, letterSpacing: 0.7, color: "#302313", textAlign: "center" },
  value: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 14, color: "#201A12", textAlign: "center" },
  unrevealed: { fontSize: 11 },
  note: { fontFamily: "PremiereSans", fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 3 },
})
