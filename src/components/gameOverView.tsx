import React, { useState } from "react"
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"
import { PlayerGame } from "../models/game"
import { API_CONFIG } from "../config/constants"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { savedScore, manualHintsUsed } from "../utils/resultSummary"
import { releaseYear } from "../utils/dateDisplay"
import { imdbPersonUrl, imdbTitleUrl } from "../utils/imdbLinks"
import { movieReward } from "../services/movieRewardService"
import { useExternalLink } from "../utils/hooks/useExternalLink"
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

// Reset failed images and expanded controls when revisiting a different result.
export default function GameOverView(props: GameOverViewProps) {
  return <MovieRewardScreen key={props.playerGame.id} {...props} />
}

function MovieRewardScreen({ playerGame: game, lastGuessResult }: GameOverViewProps) {
  const reduced = usePremiereMotion()
  const s = useStyles(themedStyles)
  const { colors } = useThemeTokens()
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

  return <Animated.View testID="cinematic-reward" entering={FadeInDown.duration(450).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={s.page}>
    <View style={s.celebration}>
      <View accessibilityRole="header" accessible tabIndex={Platform.OS === "web" ? -1 : undefined} testID="result-heading">
        <Text style={[s.resultTitle, narrow && s.resultTitleNarrow]}>{result}</Text>
      </View>
      <Text style={s.resultMessage}>{message} · {difficulty}</Text>
    </View>
    <View style={s.hero}>
      <Image testID="reward-backdrop" accessibilityLabel={`${movie.title} artwork`} accessible source={heroUrl ? { uri: heroUrl } : fallback}
        onError={() => fail(heroUrl)} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={[`${colors.background}00`, colors.background]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
    </View>
    <View style={[s.filmReveal, narrow && s.filmRevealNarrow, fontScale > 1.3 && s.filmRevealLargeText]}>
      <View style={[s.posterFrame, narrow && s.posterFrameNarrow]}>
        <Image testID="reward-poster" accessibilityLabel={`${movie.title} poster`} accessible source={available(posterUrl) ? { uri: posterUrl } : fallback}
          onError={() => fail(posterUrl)} contentFit="contain" style={s.poster} />
      </View>
      <View style={[s.filmInfo, fontScale > 1.3 && s.filmInfoLargeText]}>
        <Text style={s.eyebrow}>TODAY'S FEATURE</Text>
        <Text accessibilityRole="header" style={[s.title, narrow && s.titleNarrow]}>{movie.title}</Text>
        <Text style={s.subtitle}>{[year, genreText].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
    {!!reward.tagline && <Text style={s.tagline}>{reward.tagline}</Text>}
    <View style={s.resultStrip}>
      <View style={s.stat}><Text style={s.statNumber}>{score === null ? "—" : score.toLocaleString()}</Text><Text style={s.statLabel}>{score === null ? "Score unavailable" : "POINTS EARNED"}</Text></View>
      <View style={[s.stat, s.statDivider]}><Text style={s.statNumber}>{game.guesses.length}</Text><Text style={s.statLabel}>GUESSES USED</Text></View>
      <View style={[s.stat, s.statDivider]}><Text style={s.statNumber}>{difficulty}</Text><Text style={s.statLabel}>DIFFICULTY</Text></View>
    </View>
    {game.difficulty === "LEVEL_2" && manualHintsUsed(game) > 0 && <Text style={s.note}>
      {manualHintsUsed(game)} hints used{game.correctAnswer ? ` · ${manualHintsUsed(game) * 50} hint points already deducted` : ""}
    </Text>}
    {reward.people.length > 0 && <View style={s.castSection}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Starring</Text>
      <View style={s.cast}>{reward.people.map((person, i) => {
        const url = imdbPersonUrl(person.imdbId)
        const portraitUrl = imageUrl(person.portrait, API_CONFIG.TMDB_IMAGE_BASE_URL_W185)
        const content = <>
          <Image accessibilityLabel={person.name} source={available(portraitUrl) ? { uri: portraitUrl } : require("../../assets/actor_default.png")}
            onError={() => fail(portraitUrl)} contentFit="cover" contentPosition={{ top: "20%", left: "50%" }} style={[s.portrait, narrow && s.portraitNarrow]} />
          <Text style={[s.actorName, narrow && s.actorNameNarrow]}>{person.name}</Text>
        </>
        const style = [s.person, fontScale > 1.3 && s.personLargeText]
        return url ? <Pressable key={`${person.name}-${i}`} accessibilityRole="link" accessibilityLabel={`Open IMDb page for ${person.name}`} onPress={() => openLink(url)} style={style}>{content}</Pressable>
          : <View key={`${person.name}-${i}`} style={style}>{content}</View>
      })}</View>
    </View>}
    <View style={[s.storyCard, narrow && s.storyCardNarrow]}>
      <Text accessibilityRole="header" style={s.sectionTitle}>The story</Text>
      <Text style={s.body}>{reward.summary}</Text>
      <View style={s.facts}>
        {credits.map(h => <View key={h.type} style={s.credit}><Text style={s.creditLabel}>{h.label.toUpperCase()}</Text><Text style={s.creditValue}>{String(h.value)}</Text></View>)}
        {!!released && <View style={s.credit}><Text style={s.creditLabel}>RELEASED</Text><Text style={s.creditValue}>{released}</Text></View>}
        {!!genreText && <View style={s.credit}><Text style={s.creditLabel}>GENRES</Text><Text style={s.creditValue}>{genreText}</Text></View>}
        <View style={s.credit}><Text style={s.creditLabel}>YOUR CHALLENGE</Text><Text style={s.creditValue}>{difficulty} · {message}</Text></View>
      </View>
      {titleUrl && <Pressable accessibilityRole="link" onPress={() => openLink(titleUrl)} style={s.external}><Text style={s.link}>Explore {movie.title} on IMDb ↗</Text></Pressable>}
    </View>
    <View style={s.actions}><ShareResultButton playerGame={game} /></View>
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
  filmInfo: { flex: 1, minWidth: 0, paddingBottom: 2 },
  filmInfoLargeText: { flex: 0, width: "100%" },
  eyebrow: { fontFamily: "PremiereSans", fontSize: 10, lineHeight: 16, letterSpacing: 2, color: theme.colors.textSecondary },
  title: { fontFamily: "PremiereDisplay", fontSize: 42, lineHeight: 47, color: theme.colors.textPrimary, marginTop: 5, marginBottom: 7 },
  titleNarrow: { fontSize: 36, lineHeight: 40 },
  subtitle: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 19, color: theme.colors.textSecondary },
  tagline: { fontFamily: "PremiereClue", fontSize: 21, lineHeight: 28, color: theme.colors.textPrimary, textAlign: "center", marginTop: 22, marginHorizontal: 25 },
  resultStrip: { flexDirection: "row", marginHorizontal: 25, marginTop: 22, paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 4, alignItems: "center" },
  statDivider: { borderLeftWidth: 1, borderColor: `${theme.colors.border}66` },
  statNumber: { fontFamily: "PremiereDisplay", fontSize: 30, lineHeight: 34, color: theme.colors.textPrimary, textAlign: "center" },
  statLabel: { fontFamily: "PremiereSans", fontSize: 9, lineHeight: 14, letterSpacing: 1, color: theme.colors.textSecondary, marginTop: 6, textAlign: "center" },
  note: { fontFamily: "PremiereSans", fontSize: 11, lineHeight: 17, color: theme.colors.textSecondary, marginTop: 8, marginHorizontal: 25 },
  castSection: { marginTop: 23, marginHorizontal: 25 },
  sectionTitle: { fontFamily: "PremiereDisplay", fontSize: 26, lineHeight: 32, color: theme.colors.textPrimary, marginBottom: 12 },
  cast: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  person: { width: "22%", flexGrow: 1, maxWidth: "25%", minHeight: 44 },
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
