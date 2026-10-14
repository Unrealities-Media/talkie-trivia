import React, { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"
import ProjectionHints from "./projectionHints"
import { useTheme } from "../contexts/themeContext"

export const premiere = { ink: "#03131C", cream: "#F8E7CA", coral: "#FF7868", muted: "#B9C0C3" }

export default function PremiereStage({ children, cue }: { children: React.ReactNode; cue: number }) {
  const reduced = usePremiereMotion()
  const { colors } = useTheme()
  const projection = useSharedValue(1)
  const [isLaidOut, setIsLaidOut] = useState(false)
  const [theatreWidth, setTheatreWidth] = useState(458)
  const theatreScale = theatreWidth / 458
  useEffect(() => {
    if (!isLaidOut) return
    projection.value = reduced ? 1 : 0
    if (!reduced) projection.value = withTiming(1, { duration: 1150, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(projection)
  }, [cue, reduced, projection, isLaidOut])
  // Animate the projection light without scaling the text-bearing layer.
  // Keeping glyphs at their layout size avoids resampling their fine strokes.
  const screen = useAnimatedStyle(() => ({ opacity: 0.65 + projection.value * 0.35 }))
  const sweep = useAnimatedStyle(() => ({ opacity: Math.sin(projection.value * Math.PI) * 0.3, transform: [{ translateX: -300 + projection.value * 850 }, { rotate: "-18deg" }] }))
  const light = useAnimatedStyle(() => ({ opacity: 0.65 + projection.value * 0.35, transform: [{ scale: 1.04 - projection.value * 0.04 }] }))

  return <View style={styles.stage}>
    <Animated.View onLayout={() => setIsLaidOut(true)} style={[styles.screen, screen]}>
      <Image source={require("../../assets/premiere/screen.png")} style={[StyleSheet.absoluteFill, { opacity: 0.65 }]} contentFit="fill" accessible={false} />
      <View style={styles.paper}>
        <Text style={styles.screenLabel}>GUESS THE MOVIE</Text>
        <View style={styles.rule} />
        <Text style={styles.clueLabel}>CLUE {String(Math.min(cue + 1, 5)).padStart(2, "0")}</Text>
        {children}
        <ProjectionHints />
      </View>
      <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.sweep, sweep]} />
    </Animated.View>
    <Animated.View onLayout={event => setTheatreWidth(event.nativeEvent.layout.width)} pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.theatre, { height: 69 * theatreScale }, light]}>
      {/* Render only the text-free theater strip of the approved board, preserving its original pixels. */}
      <Image source={require("../../assets/premiere/reference-board.png")} style={{ position: "absolute", width: 1536 * theatreScale, height: 1024 * theatreScale, left: -442 * theatreScale, top: -354 * theatreScale }} contentFit="fill" accessible={false} />
    </Animated.View>
    <Text style={[styles.caption, { color: colors.textSecondary }]}>SOME STORIES STAY WITH YOU</Text>
  </View>
}

const styles = StyleSheet.create({
  stage: { width: "100%", paddingTop: 12, paddingBottom: 8 },
  screen: { marginHorizontal: 25, borderRadius: 2, overflow: "hidden", backgroundColor: premiere.cream, zIndex: 2 },
  paper: { paddingTop: 16, paddingBottom: 14, minHeight: 194 },
  screenLabel: { fontFamily: "PremiereSans", textAlign: "center", color: premiere.ink, fontSize: 10, letterSpacing: 3.4 },
  rule: { width: 60, height: 1, backgroundColor: "#A89A80", alignSelf: "center", marginVertical: 7 },
  clueLabel: { fontFamily: "PremiereSans", textAlign: "center", color: premiere.ink, fontSize: 10, letterSpacing: 3.2 },
  sweep: { position: "absolute", top: -80, bottom: -80, width: 90, backgroundColor: "#FFFFFF" },
  theatre: { width: "100%", marginTop: -6, overflow: "hidden" },
  caption: { fontFamily: "PremiereSans", color: premiere.muted, textAlign: "center", letterSpacing: 3.3, fontSize: 7, marginTop: 6, marginBottom: 9 },
})
