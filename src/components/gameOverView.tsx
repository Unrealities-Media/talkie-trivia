import React, { useState } from "react"
import { View, Text, Pressable, StyleSheet } from "react-native"
import { Image } from "expo-image"
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"
import { PlayerGame } from "../models/game"
import { API_CONFIG } from "../config/constants"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { savedScore, manualHintsUsed } from "../utils/resultSummary"
import { releaseYear } from "../utils/dateDisplay"
import { imdbPersonUrl, imdbTitleUrl } from "../utils/imdbLinks"
import { useExternalLink } from "../utils/hooks/useExternalLink"
import DifficultySelector from "./difficultySelector"
import CountdownTimer from "./countdownTimer"
import GuessesContainer from "./guesses"
import ShareResultButton from "./gameOver/shareResultButton"
import { useStyles, Theme } from "../utils/hooks/useStyles"

interface GameOverViewProps {
  playerGame: PlayerGame
  lastGuessResult: { itemId: number | string; correct: boolean } | null
}

export default function GameOverView({ playerGame: game, lastGuessResult }: GameOverViewProps) {
  const s = useStyles(themedStyles)
  const [showGuesses, setShowGuesses] = useState(false)
  const [failedPoster, setFailedPoster] = useState<string | null>(null)
  const { openLink } = useExternalLink()
  const movie = game.triviaItem
  const score = savedScore(game)
  const year = releaseYear(movie.releaseDate)
  const titleUrl = imdbTitleUrl(movie.metadata.imdb_id)
  const genres = movie.hints.find(h => h.type === "genre")?.value
  const cast = movie.hints.find(h => h.type === "actors")?.value
  const people = Array.isArray(cast) ? cast.filter(p => p && typeof p.name === "string") : []
  const result = game.correctAnswer ? "That's a wrap!" : game.gaveUp ? "Answer revealed" : "Out of guesses"
  const message = game.correctAnswer
    ? `Solved in ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}`
    : game.gaveUp ? `Revealed after ${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}`
    : `${game.guesses.length} guesses used`
  const fallback = require("../../assets/premiere/theatre.png")
  return <Animated.View key={game.id} entering={FadeInDown.duration(450).reduceMotion(ReduceMotion.System)} style={s.page}>
    <View style={s.programme}>
      <Text style={s.eyebrow}>TODAY'S FEATURE</Text>
      <Text accessibilityRole="header" style={s.title}>{movie.title}</Text>
      <Text style={s.subtitle}>{[year, typeof genres === "string" ? genres : null].filter(Boolean).join(" · ")}</Text>
      <View style={s.posterFrame}>
        <Image accessibilityLabel={`${movie.title} poster`} accessible
          source={movie.posterPath && failedPoster !== movie.posterPath ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${movie.posterPath}` } : fallback}
          onError={() => setFailedPoster(movie.posterPath)} contentFit="contain" style={s.poster} />
      </View>
      {movie.metadata.tagline ? <Text style={s.tagline}>{movie.metadata.tagline}</Text> : null}
      <View style={s.result}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={s.resultTitle}>{result}</Text>
          <Text style={s.body}>{message}</Text>
          <Text style={s.muted}>{DIFFICULTY_MODES[game.difficulty].label}</Text>
        </View>
        <View style={s.score}>
          <Text style={s.scoreNumber}>{score === null ? "—" : score.toLocaleString()}</Text>
          <Text style={s.scoreLabel}>{score === null ? "Score unavailable" : "POINTS"}</Text>
        </View>
      </View>
      {game.difficulty === "LEVEL_2" && manualHintsUsed(game) > 0 && <Text style={s.note}>
        {manualHintsUsed(game)} hints used{game.correctAnswer ? ` · ${manualHintsUsed(game) * 50} hint points already deducted` : ""}
      </Text>}
      <ShareResultButton playerGame={game} />
      <View style={s.next}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Another movie?</Text>
        <Text style={s.body}>Each difficulty has a different movie today. Pick one to play or revisit your result.</Text>
        <DifficultySelector />
      </View>
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>The story</Text>
        <Text style={s.body}>{movie.description}</Text>
        <Text style={s.note}>The complete clue for this challenge</Text>
      </View>
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>Behind the picture</Text>
        {movie.hints.filter(h => h.type !== "actors" && h.type !== "genre" && !(h.type === "decade" && year)).map(h =>
          <View key={h.type} style={s.credit}>
            <Text style={s.creditLabel}>{h.label}</Text>
            <Text style={s.body}>{typeof h.value === "string" || typeof h.value === "number" ? String(h.value) : ""}</Text>
          </View>)}
        {people.length > 0 && <>
          <Text style={s.creditLabel}>Starring</Text>
          <View style={s.cast}>
            {people.map((person, i) => {
              const url = imdbPersonUrl(person.imdb_id)
              const content = <>
                {person.profile_path && <Image source={{ uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W185}${person.profile_path}` }} contentFit="cover" style={s.portrait} />}
                <Text style={[s.body, url ? s.link : undefined]}>{person.name}</Text>
              </>
              return url ? <Pressable key={`${person.name}-${i}`} accessibilityRole="link" accessibilityLabel={`Open IMDb page for ${person.name}`} onPress={() => openLink(url)} style={s.person}>{content}</Pressable>
                : <View key={`${person.name}-${i}`} style={s.person}>{content}</View>
            })}
          </View>
        </>}
        {titleUrl && <Pressable accessibilityRole="link" onPress={() => openLink(titleUrl)} style={s.external}>
          <Text style={s.link}>Explore {movie.title} on IMDb ↗</Text>
        </Pressable>}
      </View>
    </View>
    <CountdownTimer />
    {game.guesses.length > 0 && <View style={s.history}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showGuesses }} onPress={() => setShowGuesses(value => !value)} style={s.historyToggle}>
        <Text style={s.link}>{showGuesses ? "Hide" : "View"} your guesses ({game.guesses.length}) {showGuesses ? "−" : "+"}</Text>
      </Pressable>
      {showGuesses && <GuessesContainer lastGuessResult={lastGuessResult} />}
    </View>}
  </Animated.View>
}

const themedStyles = (theme: Theme) => StyleSheet.create({
  page: { width: "100%", paddingHorizontal: 20, paddingTop: 10, gap: 20 },
  programme: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, padding: 18, borderRadius: 3 },
  eyebrow: { fontFamily: "PremiereSans", fontSize: 10, letterSpacing: 3, color: theme.colors.textSecondary, textAlign: "center", marginBottom: 10 },
  title: { fontFamily: "PremiereDisplay", fontSize: 34, lineHeight: 40, color: theme.colors.textPrimary, textAlign: "center" },
  subtitle: { fontFamily: "PremiereSans", fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, textAlign: "center", marginTop: 8, marginBottom: 18 },
  posterFrame: { width: "78%", maxWidth: 260, alignSelf: "center", padding: 5, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundLight, ...theme.shadows.medium },
  poster: { width: "100%", aspectRatio: 2 / 3 },
  tagline: { fontFamily: "PremiereClue", fontSize: 18, lineHeight: 25, color: theme.colors.textSecondary, textAlign: "center", marginTop: 16 },
  result: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, marginTop: 22, paddingVertical: 16 },
  resultTitle: { fontFamily: "PremiereDisplay", fontSize: 26, lineHeight: 32, color: theme.colors.textPrimary, marginBottom: 4 },
  body: { fontFamily: "PremiereSans", fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary },
  muted: { fontFamily: "PremiereSans", fontSize: 12, lineHeight: 19, color: theme.colors.textSecondary },
  score: { alignItems: "center", maxWidth: "40%", paddingLeft: 10, borderLeftWidth: 1, borderColor: theme.colors.border },
  scoreNumber: { fontFamily: "PremiereDisplay", fontSize: 36, lineHeight: 42, color: theme.colors.textPrimary },
  scoreLabel: { fontFamily: "PremiereSans", fontSize: 10, letterSpacing: 1, color: theme.colors.textSecondary, textAlign: "center" },
  note: { fontFamily: "PremiereSans", fontSize: 11, lineHeight: 17, color: theme.colors.textSecondary, marginTop: 8 },
  section: { borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 18, marginTop: 16, gap: 10 },
  sectionTitle: { fontFamily: "PremiereDisplay", fontSize: 26, lineHeight: 32, color: theme.colors.textPrimary },
  credit: { gap: 2, marginBottom: 8 },
  creditLabel: { fontFamily: "PremiereSans", fontSize: 11, letterSpacing: 1, color: theme.colors.textSecondary },
  cast: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  person: { width: "45%", gap: 7, minHeight: 44 },
  portrait: { width: 64, height: 86, borderRadius: 2 },
  link: { fontFamily: "PremiereSans", fontSize: 14, lineHeight: 22, color: theme.colors.accentText, textDecorationLine: "underline" },
  external: { minHeight: 44, justifyContent: "center", marginTop: 8 },
  next: { gap: 12 },
  history: { borderTopWidth: 1, borderColor: theme.colors.border },
  historyToggle: { minHeight: 48, justifyContent: "center" },
})
