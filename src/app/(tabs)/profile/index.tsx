import React, { lazy, Suspense, useState } from "react"
import { View, Text, ScrollView, Pressable } from "react-native"
import { router } from "expo-router"
import { useAuth } from "../../../contexts/authContext"
import { useTheme } from "../../../contexts/themeContext"
import { useGameStore } from "../../../state/gameStore"
import { DIFFICULTY_MODES, DifficultyLevel } from "../../../config/difficulty"
import AccountStats from "../../../components/accountStats"
import ProfileHistory from "../../../components/profileHistory"
import ErrorMessage from "../../../components/errorMessage"
import LoadingIndicator from "../../../components/loadingIndicator"
import { Button } from "../../../components/ui/button"
import DetailModal from "../../../components/detailModal"

const AccountMerge = lazy(() => import("../../../components/accountMerge"))
const SessionRecovery = lazy(() => import("../../../components/sessionRecovery"))

export default function ProfileScreen() {
  const { player, user, loading: authLoading, error: authError, retryAuthentication, merge, mergeProposal, lostSession, deletion } = useAuth()
  const { colors } = useTheme()
  const statuses = useGameStore(s => s.dailyChallenges)
  const challengeDate = useGameStore(s => s.challengeDate)
  const gameUid = useGameStore(s => s.playerGame.playerID)
  const deadline = useGameStore(s => s.resetDeadline)
  const loading = useGameStore(s => s.loading)
  const error = useGameStore(s => s.error)
  const syncStatus = useGameStore(s => s.syncStatus)
  const setDifficulty = useGameStore(s => s.setDifficulty)
  const initializeGame = useGameStore(s => s.initializeGame)
  const [choosing, setChoosing] = useState(false)
  const signedIn = !!(player && user)
  const ready = signedIn && gameUid === player.id && !!challengeDate && deadline !== null && performance.now() < deadline && !loading && !error && Object.keys(DIFFICULTY_MODES).every(level => statuses[level as DifficultyLevel] !== undefined)
  const completed = ready ? Object.values(statuses).filter(status => status === "Won" || status === "Lost").length : 0
  const blocked = authLoading || !!deletion || !!merge || !!mergeProposal || loading || syncStatus !== "idle"
  const text = { fontFamily: "PremiereSans", color: colors.textSecondary, fontSize: 13, lineHeight: 20 }
  const heading = { fontFamily: "PremiereDisplay", color: colors.textPrimary, fontSize: 28 }
  const name = player?.name && !["Player", "Guest"].includes(player.name) ? player.name : null
  const openGame = (level: DifficultyLevel) => {
    if (!player || blocked) return
    setDifficulty(level)
    if (!gameUid) void initializeGame(player, level)
    setChoosing(false)
    router.navigate("/game")
  }
  return <>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 420, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ ...heading, fontSize: 22 }}>TALKIE TRIVIA</Text>
          <Button title="Settings" variant="secondary" onPress={() => router.push("/profile/settings")} />
        </View>
        <View>
          <Text accessibilityRole="header" style={{ ...heading, fontSize: 38 }}>Your profile</Text>
          <Text style={text}>{name ? `Welcome back, ${name}.` : user?.isAnonymous ? "Guest player · Progress saved" : "Your life in movies, one challenge at a time."}</Text>
        </View>
        {authLoading && <LoadingIndicator message="Opening your player account…" />}
        <Suspense fallback={<LoadingIndicator />}>
          {(merge || mergeProposal) && <AccountMerge />}
          {!authLoading && lostSession && !deletion && <SessionRecovery />}
        </Suspense>
        {!authLoading && !signedIn && !lostSession && !deletion && !merge && !mergeProposal && <ErrorMessage message={authError || "Your player account could not be opened."} onRetry={retryAuthentication} />}
        {deletion && <Button title="Continue account deletion" onPress={() => router.push("/profile/settings")} />}
        {signedIn && <>
          <AccountStats key={player.id} player={player} compact />
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
              <Text style={{ ...text, color: colors.textPrimary }}>Today's challenges</Text>
              <Text style={text}>{ready ? `${completed} of 5 complete` : "Progress unavailable"}</Text>
            </View>
            {ready && <View accessibilityLabel={`${completed} of 5 daily challenges completed`} style={{ flexDirection: "row", gap: 5 }}>
              {Object.keys(DIFFICULTY_MODES).map((key, index) => <View key={key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index < completed ? colors.success : colors.border }} />)}
            </View>}
            <Text style={text}>{!ready ? "Open Play to load today's challenges. Your movie history is still available." : completed === 5 ? "All five completed. Come back for the next daily movies." : completed > 0 ? `Streak secured. ${5 - completed} ${completed === 4 ? "movie" : "movies"} left to discover.` : "Five movies to discover. Start with any difficulty."}</Text>
            {syncStatus === "pending" && <Text style={text}>Open Play to retry your pending move.</Text>}
            <Button title={ready && completed < 5 && !blocked ? "Choose your next challenge →" : "Open Play →"} onPress={() => ready && completed < 5 && !blocked ? setChoosing(true) : router.navigate("/game")} />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text accessibilityRole="header" style={heading}>Recent movies</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push("/profile/statistics")} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ ...text, color: colors.accentText }}>All stats ↗</Text>
              </Pressable>
            </View>
            <ProfileHistory compact />
            <Button title="View all movies" variant="secondary" onPress={() => router.push("/profile/history")} />
          </View>
          {user.isAnonymous && <View style={{ gap: 8 }}><Text style={text}>Keep access to your progress on other devices.</Text><Button title="Link account" variant="secondary" onPress={() => router.push("/profile/settings")} /></View>}
        </>}
      </View>
    </ScrollView>
    <DetailModal show={choosing && signedIn && !deletion && !merge && !mergeProposal} toggleModal={setChoosing}>
      <Text accessibilityRole="header" style={heading}>Your next challenge</Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        {(Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]).map(level => <Button key={level}
          title={`${DIFFICULTY_MODES[level].label} · ${ready ? statuses[level] ?? "Not started" : "Reload progress"}`}
          disabled={blocked} onPress={() => openGame(level)} />)}
      </View>
    </DetailModal>
  </>
}
