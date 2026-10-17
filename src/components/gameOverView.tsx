import React, { useEffect, useState } from "react"
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform, LayoutChangeEvent } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, ReduceMotion, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated"
import { PlayerGame } from "../models/game"
import { API_CONFIG } from "../config/constants"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { savedScore, manualHintsUsed } from "../utils/resultSummary"
import { releaseYear } from "../utils/dateDisplay"
import { imdbPersonUrl, imdbTitleUrl } from "../utils/imdbLinks"
import { movieReward } from "../services/movieRewardService"
import { useExternalLink } from "../utils/hooks/useExternalLink"
import { useCountUp } from "../utils/hooks/useCountUp"
import { useGameStore } from "../state/gameStore"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"
import CountdownTimer from "./countdownTimer"
import NextChallenge from "./nextChallenge"
import GuessesContainer from "./guesses"
import ShareResultButton from "./gameOver/shareResultButton"
import { useStyles, useThemeTokens, Theme } from "../utils/hooks/useStyles"

interface GameOverViewProps {
  playerGame: PlayerGame
  lastGuessResult: { itemId: number | string; correct: boolean } | null
}

// Web needs an explicit choice: the system setting is not read there (see usePremiereMotion).
const motionFor = (reduced: boolean) => reduced ? ReduceMotion.Always : ReduceMotion.Never

/** Runs a 0 → 1 timeline once on mount, or jumps to 1 when motion is reduced. */
function useEntrance(delay: number, run: (to: number) => number) {
  const reduced = usePremiereMotion()
  const progress = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) { progress.value = 1; return }
    progress.value = withDelay(delay, run(1))
    return () => cancelAnimation(progress)
  }, [reduced, delay, progress, run])
  return progress
}
// Settles exactly at rest so the artwork band keeps its laid-out size.
const settle = (to: number) => withTiming(to, { duration: 3000, easing: Easing.out(Easing.cubic) })
const rise = (to: number) => withTiming(to, { duration: 850, easing: Easing.out(Easing.back(1.6)) })
const spring = (to: number) => withSpring(to, { damping: 13, stiffness: 90 })
const sweep = (to: number) => withTiming(to, { duration: 950, easing: Easing.inOut(Easing.cubic) })
const grow = (to: number) => withTiming(to, { duration: 420, easing: Easing.out(Easing.cubic) })

// Reset failed images and expanded controls when revisiting a different result.
export default function GameOverView(props: GameOverViewProps) {
  return <MovieRewardScreen key={props.playerGame.id} {...props} />
}

function MovieRewardScreen({ playerGame: game, lastGuessResult }: GameOverViewProps) {
  const reduced = usePremiereMotion()
  const s = useStyles(themedStyles)
  const { colors } = useThemeTokens()
  const streak = useGameStore(state => state.playerStats.currentStreak)
  const enter = (delay: number) => FadeInDown.delay(delay).duration(550).reduceMotion(motionFor(reduced))
  const { width, fontScale } = useWindowDimensions()
  const narrow = width <= 390
  const [showGuesses, setShowGuesses] = useState(false)
  const [failedImages, setFailedImages] = useState<string[]>([])
  const { openLink } = useExternalLink()
  const movie = game.triviaItem
  const reward = movieReward(movie)
  const score = savedScore(game)
  const year = releaseYear(movie.releaseDate)
  const difficulty = DIFFICULTY_MODES[game.difficulty].label
  const titleUrl = imdbTitleUrl(movie.metadata.imdb_id)
  const genres = movie.hints.find(h => h.type === "genre")?.value
  const genreText = typeof genres === "string" ? genres : ""
  const result = game.correctAnswer ? "That's a wrap!" : game.gaveUp ? "Answer revealed" : "Out of guesses"
  const message = game.correctAnswer
    ? `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}`
    : game.gaveUp ? `Revealed after ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}`
    : `${game.guesses.length} guesses used`
  const imageUrl = (path: string | undefined, base: string) => path ? `${base}${path}` : undefined
  const posterUrl = imageUrl(movie.posterPath, API_CONFIG.TMDB_IMAGE_BASE_URL_W500)
  const backdropUrl = imageUrl(reward.backdrop, API_CONFIG.TMDB_IMAGE_BASE_URL_W780)
  const available = (url: string | undefined) => url && !failedImages.includes(url) ? url : undefined
  const fail = (url: string | undefined) => { if (url) setFailedImages(previous => previous.includes(url) ? previous : [...previous, url]) }
  const heroUrl = available(backdropUrl) || available(posterUrl)
  const fallback = require("../../assets/premiere/theatre.png")
  const credits = movie.hints.filter(h => !["actors", "genre", "decade"].includes(h.type) && (typeof h.value === "string" || typeof h.value === "number"))
  const decade = movie.hints.find(h => h.type === "decade")?.value
  const released = [year, typeof decade === "string" ? decade : null].filter(Boolean).join(" · ")
  const points = useCountUp(score ?? 0, { delay: 1100, duration: 1100 })
  const hints = game.difficulty === "LEVEL_2" ? manualHintsUsed(game) : 0
  const title = useEntrance(120, rise)
  const backdrop = useEntrance(250, settle)
  const poster = useEntrance(550, spring)
  const glint = useEntrance(1500, sweep)
  const titleMotion = useAnimatedStyle(() => ({ opacity: Math.min(1, title.value * 1.4), transform: [{ perspective: 600 }, { translateY: (1 - title.value) * 34 }, { rotateX: `${(1 - title.value) * -60}deg` }] }))
  const kenBurns = useAnimatedStyle(() => ({ opacity: Math.min(1, backdrop.value * 12), transform: [{ scale: 1.12 - backdrop.value * 0.12 }, { translateX: (1 - backdrop.value) * 8 }] }))
  const posterMotion = useAnimatedStyle(() => ({ opacity: Math.min(1, poster.value * 2), transform: [{ perspective: 800 }, { translateY: (1 - poster.value) * 60 }, { rotateY: `${(1 - poster.value) * -25}deg` }, { scale: 0.9 + poster.value * 0.1 }] }))
  const glintMotion = useAnimatedStyle(() => ({ opacity: glint.value > 0 && glint.value < 1 ? 1 : 0, transform: [{ translateX: -120 + glint.value * 260 }, { rotate: "18deg" }] }))

  return <Animated.View testID="cinematic-reward" entering={FadeInDown.duration(450).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={s.page}>
    <View style={s.celebration}>
      <View accessibilityRole="header" accessible tabIndex={Platform.OS === "web" ? -1 : undefined} testID="result-heading">
        <Animated.Text style={[s.resultTitle, narrow && s.resultTitleNarrow, titleMotion]}>{result}</Animated.Text>
      </View>
      <Animated.Text entering={enter(450)} style={s.resultMessage}>{message} · {difficulty}</Animated.Text>
    </View>
    <View style={s.hero}>
      <Animated.View style={[StyleSheet.absoluteFill, kenBurns]}>
        <Image testID="reward-backdrop" accessibilityLabel={`${movie.title} artwork`} accessible source={heroUrl ? { uri: heroUrl } : fallback}
          onError={() => fail(heroUrl)} contentFit="cover" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <LinearGradient pointerEvents="none" colors={[`${colors.background}00`, colors.background]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
    </View>
    <View style={[s.filmReveal, narrow && s.filmRevealNarrow, fontScale > 1.3 && s.filmRevealLargeText]}>
      <Animated.View style={[s.posterFrame, narrow && s.posterFrameNarrow, posterMotion]}>
        <Image testID="reward-poster" accessibilityLabel={`${movie.title} poster`} accessible source={available(posterUrl) ? { uri: posterUrl } : fallback}
          onError={() => fail(posterUrl)} contentFit="contain" style={s.poster} />
        <View pointerEvents="none" style={s.glintClip}>
          <Animated.View style={[s.glint, glintMotion]}>
            <LinearGradient colors={["#F8E7CA00", "#F8E7CA80", "#F8E7CA00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View entering={enter(900)} style={[s.filmInfo, fontScale > 1.3 && s.filmInfoLargeText]}>
        <Text style={s.eyebrow}>TODAY'S FEATURE</Text>
        <Text accessibilityRole="header" style={[s.title, narrow && s.titleNarrow]}>{movie.title}</Text>
        <Text style={s.subtitle}>{[year, genreText].filter(Boolean).join(" · ")}</Text>
      </Animated.View>
    </View>
    {!!reward.tagline && <Animated.Text entering={enter(1000)} style={s.tagline}>{reward.tagline}</Animated.Text>}
    <Animated.View entering={enter(1000)} testID="result-scorecard" style={s.scorecard}>
      <View style={s.scoreRow}>
        <View accessible accessibilityLabel={score === null ? "Score unavailable" : `${score.toLocaleString()} points earned`}>
          <Text style={s.points}>{score === null ? "—" : points.toLocaleString()}</Text>
          <Text style={s.statLabel}>{score === null ? "Score unavailable" : "POINTS EARNED"}</Text>
        </View>
        <View accessible accessibilityLabel={`${game.guesses.length} of ${game.guessesMax} guesses used`} style={s.track}>
          {Array.from({ length: Math.max(game.guessesMax, game.guesses.length) }, (_, i) => <TrackStep key={i} index={i}
            color={game.correctAnswer && i === game.guesses.length - 1 ? colors.quinary : i < game.guesses.length ? colors.border : `${colors.border}40`} />)}
        </View>
      </View>
      <View style={s.chips}>
        <Text style={s.chip}>{difficulty}</Text>
        <Text style={s.chip}>{game.guesses.length} of {game.guessesMax} guesses</Text>
        {hints > 0 && <Text style={s.chip}>{hints} {hints === 1 ? "hint" : "hints"} used{game.correctAnswer ? ` · −${hints * 50} points` : ""}</Text>}
      </View>
    </Animated.View>
    {game.statsProcessed && streak > 0 && <Animated.View entering={enter(1300)}><StreakMarquee streak={streak} /></Animated.View>}
    <Animated.View entering={enter(1500)} style={s.actions}><ShareResultButton playerGame={game} shimmer /></Animated.View>
    {reward.people.length > 0 && <View style={s.castSection}>
      <Animated.Text entering={enter(1600)} accessibilityRole="header" style={s.sectionTitle}>Starring</Animated.Text>
      <View style={s.cast}>{reward.people.map((person, i) => {
        const url = imdbPersonUrl(person.imdbId)
        const portraitUrl = imageUrl(person.portrait, API_CONFIG.TMDB_IMAGE_BASE_URL_W185)
        const content = <>
          <Image accessibilityLabel={person.name} source={available(portraitUrl) ? { uri: portraitUrl } : require("../../assets/actor_default.png")}
            onError={() => fail(portraitUrl)} contentFit="cover" contentPosition={{ top: "20%", left: "50%" }} style={[s.portrait, narrow && s.portraitNarrow]} />
          <Text style={[s.actorName, narrow && s.actorNameNarrow]}>{person.name}</Text>
        </>
        return <Animated.View key={`${person.name}-${i}`} entering={enter(1700 + i * 110)} style={[s.person, fontScale > 1.3 && s.personLargeText]}>
          {url ? <Pressable accessibilityRole="link" accessibilityLabel={`Open IMDb page for ${person.name}`} onPress={() => openLink(url)}
            style={({ pressed }) => pressed && s.personPressed}>{content}</Pressable> : content}
        </Animated.View>
      })}</View>
    </View>}
    <Animated.View entering={FadeIn.delay(1900).duration(600).reduceMotion(motionFor(reduced))} style={[s.storyCard, narrow && s.storyCardNarrow]}>
      <Text accessibilityRole="header" style={s.sectionTitle}>The story</Text>
      <Text style={s.body}>{reward.summary}</Text>
      <View style={s.facts}>
        {credits.map(h => <View key={h.type} style={s.credit}><Text style={s.creditLabel}>{h.label.toUpperCase()}</Text><Text style={s.creditValue}>{String(h.value)}</Text></View>)}
        {!!released && <View style={s.credit}><Text style={s.creditLabel}>RELEASED</Text><Text style={s.creditValue}>{released}</Text></View>}
        {!!genreText && <View style={s.credit}><Text style={s.creditLabel}>GENRES</Text><Text style={s.creditValue}>{genreText}</Text></View>}
        <View style={s.credit}><Text style={s.creditLabel}>YOUR CHALLENGE</Text><Text style={s.creditValue}>{difficulty} · {message}</Text></View>
      </View>
      {titleUrl && <Pressable accessibilityRole="link" onPress={() => openLink(titleUrl)} style={s.external}><Text style={s.link}>Explore {movie.title} on IMDb ↗</Text></Pressable>}
    </Animated.View>
    {game.guesses.length > 0 && <View style={s.history}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showGuesses }} aria-expanded={showGuesses} onPress={() => setShowGuesses(value => !value)} style={s.historyToggle}>
        <Text style={s.link}>{showGuesses ? "Hide" : "View"} your guesses ({game.guesses.length}) {showGuesses ? "−" : "+"}</Text>
      </Pressable>
      {showGuesses && <GuessesContainer lastGuessResult={lastGuessResult} />}
    </View>}
    <View style={s.next}>
      <NextChallenge />
      <CountdownTimer compact />
    </View>
  </Animated.View>
}

function TrackStep({ index, color }: { index: number; color: string }) {
  const s = useStyles(themedStyles)
  const progress = useEntrance(1300 + index * 90, grow)
  const motion = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))
  return <Animated.View style={[s.trackStep, { backgroundColor: color }, motion]} />
}

const BULB_SPACING = 18

/** Theatre-marquee bulbs chase around the streak card. */
function StreakMarquee({ streak }: { streak: number }) {
  const s = useStyles(themedStyles)
  const reduced = usePremiereMotion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const phase = useSharedValue(0)
  useEffect(() => {
    if (reduced) return
    phase.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1)
    return () => cancelAnimation(phase)
  }, [reduced, phase])
  const { width, height } = size
  const perimeter = 2 * (width + height)
  const count = perimeter > 0 ? Math.floor(perimeter / BULB_SPACING) : 0
  const point = (distance: number) => distance < width ? [distance, 0]
    : distance < width + height ? [width, distance - width]
    : distance < 2 * width + height ? [2 * width + height - distance, height]
    : [0, perimeter - distance]
  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout
    if (w !== width || h !== height) setSize({ width: w, height: h })
  }
  return <View testID="streak-marquee" onLayout={onLayout} style={s.streak} accessible accessibilityLabel={`${streak} day streak. Every challenge you finish keeps it alive, win or lose.`}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => {
        const [x, y] = point((i / count) * perimeter)
        return <Bulb key={i} index={i} count={count} phase={phase} reduced={reduced} x={x} y={y} />
      })}
    </View>
    <Text style={s.streakNumber}>{streak}</Text>
    <View style={s.streakText}>
      <Text style={s.streakTitle}>{streak === 1 ? "Day streak" : "Days in a row"}</Text>
      <Text style={s.subtitle}>Every challenge you finish keeps it alive, win or lose.</Text>
    </View>
  </View>
}

function Bulb({ index, count, phase, reduced, x, y }: { index: number; count: number; phase: SharedValue<number>; reduced: boolean; x: number; y: number }) {
  const s = useStyles(themedStyles)
  const glow = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0.6 }
    const distance = (phase.value - index / count + 1) % 1
    return { opacity: distance < 0.12 ? 1 - distance * 6 : 0.28 }
  })
  return <Animated.View testID="marquee-bulb" style={[s.bulb, { left: x - 2.5, top: y - 2.5 }, glow]} />
}

const themedStyles = (theme: Theme) => StyleSheet.create({
  page: { width: "100%", backgroundColor: theme.colors.background },
  celebration: { paddingHorizontal: 20, paddingTop: 3, paddingBottom: 18, alignItems: "center" },
  resultTitle: { fontFamily: "PremiereDisplay-Bold", fontSize: 48, lineHeight: 53, color: theme.colors.textPrimary, textAlign: "center", marginBottom: 9 },
  resultTitleNarrow: { fontSize: 42, lineHeight: 47 },
  resultMessage: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 19, letterSpacing: 1, color: theme.colors.textSecondary, textAlign: "center" },
  hero: { width: "100%", height: 224, overflow: "hidden" },
  filmReveal: { marginTop: -48, marginHorizontal: 25, flexDirection: "row", alignItems: "flex-end", gap: 20 },
  filmRevealNarrow: { marginHorizontal: 20, gap: 14 },
  filmRevealLargeText: { alignItems: "flex-start", flexDirection: "column" },
  posterFrame: { width: 106, height: 159, padding: 4, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundLight, ...theme.shadows.medium },
  posterFrameNarrow: { width: 94, height: 141 },
  poster: { width: "100%", height: "100%" },
  glintClip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  glint: { position: "absolute", top: -40, bottom: -40, width: 46 },
  filmInfo: { flex: 1, minWidth: 0, paddingBottom: 2 },
  filmInfoLargeText: { flex: 0, width: "100%" },
  eyebrow: { fontFamily: "PremiereSans", fontSize: 10, lineHeight: 16, letterSpacing: 2, color: theme.colors.textSecondary },
  title: { fontFamily: "PremiereDisplay", fontSize: 42, lineHeight: 47, color: theme.colors.textPrimary, marginTop: 5, marginBottom: 7 },
  titleNarrow: { fontSize: 36, lineHeight: 40 },
  subtitle: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 19, color: theme.colors.textSecondary },
  tagline: { fontFamily: "PremiereClue", fontSize: 21, lineHeight: 28, color: theme.colors.textPrimary, textAlign: "center", marginTop: 22, marginHorizontal: 25 },
  scorecard: { marginHorizontal: 20, marginTop: 22, padding: 16, gap: 12, borderRadius: 14, borderWidth: 1, borderColor: `${theme.colors.border}99`, backgroundColor: theme.colors.surface },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  points: { fontFamily: "PremiereDisplay-Bold", fontSize: 40, lineHeight: 44, color: theme.colors.accentText, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: "PremiereSans", fontSize: 9, lineHeight: 14, letterSpacing: 1.5, color: theme.colors.textSecondary, marginTop: 4 },
  track: { flexDirection: "row", gap: 5 },
  trackStep: { width: 18, height: 6, borderRadius: 3, transformOrigin: "left" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { fontFamily: "PremiereSans", fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${theme.colors.textPrimary}10`, overflow: "hidden" },
  streak: { marginHorizontal: 20, marginTop: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.colors.backgroundLight },
  bulb: { position: "absolute", width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FFD38A" },
  streakNumber: { fontFamily: "PremiereDisplay-Bold", fontSize: 30, lineHeight: 34, color: theme.colors.textPrimary, minWidth: 34, textAlign: "center" },
  streakText: { flex: 1, minWidth: 0 },
  streakTitle: { fontFamily: "PremiereSans", fontSize: 13, lineHeight: 19, color: theme.colors.textPrimary },
  castSection: { marginTop: 23, marginHorizontal: 25 },
  sectionTitle: { fontFamily: "PremiereDisplay", fontSize: 26, lineHeight: 32, color: theme.colors.textPrimary, marginBottom: 12 },
  cast: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  person: { width: "22%", flexGrow: 1, maxWidth: "25%", minHeight: 44 },
  personPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  personLargeText: { width: "45%", maxWidth: "49%" },
  portrait: { width: "100%", height: 114, borderRadius: 2 },
  portraitNarrow: { height: 94 },
  actorName: { fontFamily: "PremiereSans", fontSize: 11, lineHeight: 16, color: theme.colors.textPrimary, marginTop: 7 },
  actorNameNarrow: { fontSize: 10 },
  storyCard: { marginHorizontal: 20, marginTop: 23, padding: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 3 },
  storyCardNarrow: { marginHorizontal: 12, padding: 16 },
  body: { fontFamily: "PremiereSans", fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 14, borderTopWidth: 1, borderColor: `${theme.colors.border}77`, paddingTop: 17, marginTop: 20 },
  credit: { width: "46%", flexGrow: 1, gap: 3 },
  creditLabel: { fontFamily: "PremiereSans", fontSize: 9, lineHeight: 14, letterSpacing: 1.3, color: theme.colors.textSecondary },
  creditValue: { fontFamily: "PremiereSans", fontSize: 13, lineHeight: 20, color: theme.colors.textPrimary },
  external: { minHeight: 44, justifyContent: "center", marginTop: 8 },
  link: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 19, color: theme.colors.accentText, textDecorationLine: "underline" },
  actions: { marginHorizontal: 25, paddingTop: 3, paddingBottom: 5 },
  history: { borderTopWidth: 1, borderColor: `${theme.colors.border}77`, marginHorizontal: 25, marginBottom: 20 },
  historyToggle: { minHeight: 44, justifyContent: "center" },
  next: { alignItems: "center", borderTopWidth: 1, borderColor: `${theme.colors.border}77`, paddingTop: 20, paddingBottom: 23, paddingHorizontal: 22 },
})
