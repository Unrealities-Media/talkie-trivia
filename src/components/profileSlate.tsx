import React, { useEffect } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated"
import { DIFFICULTY_MODES, DifficultyLevel } from "../config/difficulty"
import { DailyChallenges } from "../services/gameService"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"
import { useStyles, useThemeTokens, Theme } from "../utils/hooks/useStyles"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const RING = 58
const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const LEVELS = Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]
const done = (status: DailyChallenges[DifficultyLevel]) => status === "Won" || status === "Lost"

/** Today's completed challenges as a ring that draws itself in. */
export function ProgressRing({ completed, ready }: { completed: number; ready: boolean }) {
  const s = useStyles(themedStyles)
  const { colors } = useThemeTokens()
  const reduced = usePremiereMotion()
  const target = ready ? completed / LEVELS.length : 0
  const progress = useSharedValue(reduced ? target : 0)
  useEffect(() => {
    progress.value = reduced ? target : withDelay(400, withTiming(target, { duration: 1400, easing: Easing.out(Easing.cubic) }))
    return () => cancelAnimation(progress)
  }, [target, reduced, progress])
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progress.value) }))
  return <View style={s.ring} accessible accessibilityLabel={ready ? `${completed} of 5 daily challenges completed` : "Daily progress unavailable"}>
    <Svg width={RING} height={RING} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={`${colors.border}55`} strokeWidth={4} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={colors.primary} strokeWidth={4} fill="none"
        strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} animatedProps={arc} />
    </Svg>
    <Text style={s.ringText}>{ready ? `${completed}/5` : "—"}</Text>
  </View>
}

/** Five seats, one per difficulty; finished ones fill, the next one nudges. */
export function DailySlate({ statuses, onSelect }: { statuses: DailyChallenges; onSelect?: (level: DifficultyLevel) => void }) {
  const s = useStyles(themedStyles)
  const next = LEVELS.find(level => !done(statuses[level]))
  return <View style={s.slate}>
    {LEVELS.map((level, index) => <Seat key={level} level={level} index={index} status={statuses[level] ?? "Not started"}
      next={level === next} onPress={onSelect && (() => onSelect(level))} />)}
  </View>
}

function Seat({ level, index, status, next, onPress }: { level: DifficultyLevel; index: number; status: NonNullable<DailyChallenges[DifficultyLevel]>; next: boolean; onPress?: () => void }) {
  const s = useStyles(themedStyles)
  const reduced = usePremiereMotion()
  const finished = done(status)
  const fill = useSharedValue(reduced && finished ? 1 : 0)
  const bob = useSharedValue(0)
  useEffect(() => {
    const target = finished ? 1 : 0
    fill.value = reduced ? target : withDelay(700 + index * 160, withSpring(target, { damping: 14, stiffness: 120 }))
    return () => cancelAnimation(fill)
  }, [finished, reduced, index, fill])
  useEffect(() => {
    if (reduced || !next) { bob.value = 0; return }
    bob.value = withDelay(2200, withRepeat(withSequence(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 900 }),
    ), -1))
    return () => cancelAnimation(bob)
  }, [next, reduced, bob])
  const fillMotion = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - fill.value) * 40 }] }))
  const bobMotion = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -3 }] }))
  const { label, scoreMultiplier } = DIFFICULTY_MODES[level]
  const points = Math.round(scoreMultiplier * 1000)
  const glyph = status === "Won" ? "✓" : status === "Lost" ? "✕" : String(points)
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${status}${finished ? "" : `, worth up to ${points} points`}`}
    disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.seat, pressed && s.pressed]}>
    <Animated.View style={[s.seatBack, finished && s.seatDone, next && s.seatNext, bobMotion]}>
      <Animated.View style={[s.seatFill, status === "Lost" && s.seatFillLost, fillMotion]} />
      <Text style={[s.seatGlyph, finished && s.seatGlyphDone]}>{glyph}</Text>
    </Animated.View>
    <Text numberOfLines={1} adjustsFontSizeToFit style={s.seatLabel}>{label}</Text>
  </Pressable>
}

const themedStyles = (theme: Theme) => StyleSheet.create({
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringText: { position: "absolute", fontFamily: "PremiereDisplay-Bold", fontSize: 17, color: theme.colors.textPrimary },
  slate: { flexDirection: "row", gap: 6 },
  seat: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", gap: 5 },
  pressed: { opacity: 0.7 },
  seatBack: { width: "100%", height: 36, borderRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderWidth: 1.5,
    borderColor: `${theme.colors.border}AA`, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  seatDone: { borderColor: theme.colors.primary },
  seatNext: { borderColor: theme.colors.primary, borderStyle: "dashed" },
  seatFill: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.primary },
  seatFillLost: { backgroundColor: `${theme.colors.primary}66` },
  seatGlyph: { fontFamily: "PremiereSans", fontSize: 11, color: theme.colors.textSecondary },
  seatGlyphDone: { fontSize: 14, color: theme.colors.onAccent },
  seatLabel: { fontFamily: "PremiereSans", fontSize: 9, letterSpacing: 0.3, color: theme.colors.textSecondary },
})
