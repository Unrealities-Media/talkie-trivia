import React, { useCallback, useEffect, useRef, useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import { useGameStore } from "../state/gameStore"
import { API_CONFIG } from "../config/constants"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"
import { premiere } from "./premiereStage"
import PremierePosterGrade from "./premierePosterGrade"

const fallback = require("../../assets/premiere/theatre.png")

export default function RevealSequence({ onAnimationComplete }: { onAnimationComplete: () => void }) {
  const item = useGameStore(state => state.playerGame.triviaItem)
  const reduced = usePremiereMotion()
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [item?.posterPath])
  const { width, height } = useWindowDimensions()
  const progress = useSharedValue(0)
  const credits = useSharedValue(0)
  const focus = useSharedValue(0)
  const dissolve = useSharedValue(1)
  const labels = useSharedValue(1)
  const posterWidth = Math.min(width * 0.82, 360, height * 0.43)
  const posterSource = !imageFailed && item?.posterPath ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${item.posterPath}` } : fallback
  const completed = useRef(false)
  const callback = useRef(onAnimationComplete)
  callback.current = onAnimationComplete
  const finish = useCallback(() => {
    if (completed.current) return
    completed.current = true
    callback.current()
  }, [])

  useEffect(() => {
    progress.value = reduced ? 1 : 0
    credits.value = reduced ? 1 : 0
    focus.value = reduced ? 1 : 0
    dissolve.value = 1
    labels.value = 1
    if (!reduced) {
      progress.value = withDelay(120, withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.cubic) }))
      credits.value = withDelay(800, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }))
      focus.value = withDelay(120, withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }))
      dissolve.value = withDelay(2850, withTiming(0, { duration: 350, easing: Easing.inOut(Easing.cubic) }))
      labels.value = withDelay(2550, withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }))
    }
    // Completion is independent of worklet callbacks and image loading.
    const timer = setTimeout(finish, reduced ? 1800 : 3200)
    return () => {
      clearTimeout(timer)
      cancelAnimation(progress)
      cancelAnimation(credits)
      cancelAnimation(focus)
      cancelAnimation(dissolve)
      cancelAnimation(labels)
    }
  }, [reduced, finish, progress, credits, focus, dissolve, labels])

  const handoff = useAnimatedStyle(() => ({ opacity: dissolve.value }))
  const labelExit = useAnimatedStyle(() => ({ opacity: labels.value }))

  const left = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * width * 0.55 }] }))
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * width * 0.55 }] }))
  const art = useAnimatedStyle(() => ({ opacity: 0.25 + progress.value * 0.75, transform: [{ scale: 1.1 - focus.value * 0.1 }] }))
  const softFocus = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.max(0, 1 - focus.value * 1.4) }))
  const title = useAnimatedStyle(() => ({ opacity: credits.value * labels.value, transform: [{ translateY: (1 - credits.value) * 28 }] }))
  const flare = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.sin(progress.value * Math.PI) * 0.65, transform: [{ translateX: (progress.value - 0.5) * width * 1.8 }, { rotate: "-24deg" }] }))
  const rule = useAnimatedStyle(() => ({ opacity: credits.value * labels.value, transform: [{ scaleX: credits.value }] }))

  return <Modal visible transparent animationType="none" onRequestClose={finish} statusBarTranslucent>
    <Animated.View style={[styles.overlay, handoff]} accessibilityViewIsModal>
      <LinearGradient colors={["#153C48", premiere.ink, "#020B10"]} style={StyleSheet.absoluteFill} />
      <Animated.ScrollView contentContainerStyle={[styles.content, { minHeight: height }]}>
        <Animated.Text style={[styles.kicker, labelExit]}>TONIGHT'S FEATURE</Animated.Text>
        <Animated.View style={[{ width: posterWidth, height: posterWidth * 1.5, overflow: "hidden", borderRadius: 2 }, art]}>
          <Image source={posterSource}
            onError={() => setImageFailed(true)}
            accessibilityLabel={item?.title ? `${item.title} poster` : "Movie poster"}
            contentFit="cover" style={StyleSheet.absoluteFill} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, softFocus]}>
            <Image source={posterSource} blurRadius={14} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
          </Animated.View>
          <PremierePosterGrade />
        </Animated.View>
        <Animated.View style={[{ width: 72, height: 1, backgroundColor: premiere.coral, marginTop: 26 }, rule]} />
        <Animated.Text accessibilityRole="header" style={[styles.title, title]}>{item?.title || "Today's movie"}</Animated.Text>
        <Animated.View style={labelExit}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip reveal and view results" onPress={finish} style={styles.skip}>
          <Text style={styles.skipText}>View results →</Text>
        </Pressable>
        </Animated.View>
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -height * 0.2, bottom: -height * 0.2, width: 100 }, flare]}>
        <LinearGradient colors={["transparent", "#F8E7CA", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {[left, right].map((motion, index) => <Animated.View key={index} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={[styles.curtain, index === 0 ? { left: 0 } : { right: 0 }, motion]}>
        <LinearGradient colors={["#071720", "#21404A", "#0A202B", "#193440", "#061923"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={styles.curtainEdge} />
      </Animated.View>)}
    </Animated.View>
  </Modal>
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: premiere.ink },
  content: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  kicker: { fontFamily: "PremiereSans", color: premiere.coral, fontSize: 10, letterSpacing: 4, textAlign: "center", marginBottom: 22 },
  title: { color: premiere.cream, fontFamily: "PremiereDisplay", fontSize: 38, lineHeight: 46, textAlign: "center", marginTop: 16, maxWidth: 560 },
  skip: { marginTop: 20, minHeight: 48, paddingHorizontal: 28, justifyContent: "center", borderRadius: 28, borderWidth: 1, borderColor: "#647E87" },
  skipText: { fontFamily: "PremiereSans", color: premiere.cream, fontSize: 14 },
  curtain: { position: "absolute", top: 0, bottom: 0, width: "51%" },
  curtainEdge: { position: "absolute", right: 0, top: 0, bottom: 0, width: 1, backgroundColor: "#E5C69A" },
})
