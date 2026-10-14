import React, { lazy, Suspense, useState, useCallback, useEffect } from "react"
import {
  ScrollView,
  View,
  Text,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Pressable,
} from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import LoadingIndicator from "../../components/loadingIndicator"
import { useAuth } from "../../contexts/authContext"
import { GameHistoryEntry } from "../../models/gameHistory"
import ErrorMessage from "../../components/errorMessage"
import { FontAwesome } from "@expo/vector-icons"
import ProfileSection from "../../components/profileSection"
import { useStyles, Theme } from "../../utils/hooks/useStyles"
import { useTheme } from "../../contexts/themeContext"
import { useExternalLink } from "../../utils/hooks/useExternalLink"
import { u } from "../../styles/utils"
import Constants from "expo-constants"

const GoogleLogin = lazy(() => import("../../components/googleLogin"))
const AccountDeletion = lazy(() => import("../../components/accountDeletion"))
const AccountMerge = lazy(() => import("../../components/accountMerge"))
const SessionRecovery = lazy(() => import("../../components/sessionRecovery"))
const AccountStats = lazy(() => import("../../components/accountStats"))
const GameHistory = lazy(() => import("../../components/gameHistory"))
const GuestArchive = lazy(() => import("../../components/guestArchive"))
const ThemeSelector = lazy(() => import("../../components/themeSelector"))
const ReminderSettings = lazy(() => import("../../components/reminderSettings"))
const DifficultySelector = lazy(
  () => import("../../components/difficultySelector"),
)
const HistoryDetailModal = lazy(
  () => import("../../components/historyDetailModal"),
)

const Footer = () => {
  const styles = useStyles(themedStyles)
  const { openLink } = useExternalLink()
  const version = Constants.expoConfig?.version || "1.0.0"
  const tmdbLogo = require("../../../assets/tmdb_blue_square.svg")

  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Version {version}</Text>

      <Image source={tmdbLogo} style={styles.tmdbLogo} contentFit="contain" />
      <Text style={styles.footerText}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>

      <Pressable
        onPress={() => openLink("https://your-privacy-policy-url.com")}
        style={u.mtSm}
      >
        <Text style={[styles.footerText, styles.linkText]}>Privacy Policy</Text>
      </Pressable>
    </View>
  )
}

const ProfileScreen: React.FC = () => {
  const { player, user, deletion, merge, mergeProposal, lostSession, loading: authLoading, error: authError, retryAuthentication } = useAuth()
  const styles = useStyles(themedStyles)
  const { colors } = useTheme()

  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<{ uid: string; item: GameHistoryEntry } | null>(null)
  useEffect(() => { setSelectedHistoryItem(null) }, [player?.id])

  const handleHistoryItemPress = useCallback((item: GameHistoryEntry) => {
    if (player) setSelectedHistoryItem({ uid: player.id, item })
  }, [player?.id])

  const handleModalClose = useCallback(() => {
    setSelectedHistoryItem(null)
  }, [])

  const isGoogleSignedIn = player && user && !user.isAnonymous
  const isUserAuthenticated = player && user

  const displayName = player?.name || "Guest"

  return (
    <>
      <LinearGradient
        colors={[colors.background, colors.backgroundLight]}
        style={u.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Suspense fallback={<LoadingIndicator />}>
            <View style={styles.contentArea}>
              <View style={styles.header}>
                <Text style={styles.title}>Welcome, {displayName}!</Text>
              </View>

              {authLoading && <LoadingIndicator message="Opening your player account…" />}
              {(merge || mergeProposal) && <AccountMerge />}
              {!authLoading && lostSession && !deletion && <SessionRecovery />}
              {!authLoading && !isUserAuthenticated && !deletion && !lostSession && !merge && !mergeProposal && <ErrorMessage message={authError || "Your player account could not be opened."} onRetry={retryAuthentication} />}
              {isUserAuthenticated && !isGoogleSignedIn && (
                <View style={styles.signInPromptContainer}>
                  <FontAwesome
                    name="google"
                    size={styles.signInPromptIcon.fontSize}
                    color={styles.signInPromptIcon.color}
                    style={u.mbMd}
                  />
                  <Text style={styles.signInPromptTitle}>
                    Link Your Guest Account
                  </Text>
                  <Text style={styles.signInPromptText}>
                    Your guest progress is already saved. Link a Google account to keep access across devices or after reinstalling. Signing in is optional.
                  </Text>
                  <GoogleLogin />
                </View>
              )}

              {isGoogleSignedIn && (
                <ProfileSection title="Account" icon="user">
                  <GoogleLogin />
                </ProfileSection>
              )}

              <ProfileSection title="Settings" icon="cog">
                <DifficultySelector />
                <View style={styles.divider} />
                <ThemeSelector />
                <View style={styles.divider} />
                <ReminderSettings suspended={authLoading || !!deletion} />
              </ProfileSection>

              {!merge && !mergeProposal && (user || deletion) && <ProfileSection title="Account deletion" icon="trash"><AccountDeletion /></ProfileSection>}

              {isUserAuthenticated && <ProfileSection title="Statistics" icon="bar-chart">
                <AccountStats key={player.id} player={player} />
              </ProfileSection>
              }

              {isUserAuthenticated && <ProfileSection title="Game History" icon="history">
                <GameHistory key={player.id} onHistoryItemPress={handleHistoryItemPress} />
              </ProfileSection>}
              {isGoogleSignedIn && <ProfileSection title="Preserved guest games" icon="archive">
                <GuestArchive uid={player.id} />
              </ProfileSection>}

              <Footer />
            </View>
          </Suspense>
        </ScrollView>
      </LinearGradient>
      <Suspense fallback={null}>
        <HistoryDetailModal
          historyItem={isUserAuthenticated && selectedHistoryItem && selectedHistoryItem.uid === player.id ? selectedHistoryItem.item : null}
          onClose={handleModalClose}
        />
      </Suspense>
    </>
  )
}

interface ProfileScreenStyles {
  scrollContentContainer: ViewStyle
  contentArea: ViewStyle
  header: ViewStyle
  title: TextStyle
  divider: ViewStyle
  signInPromptContainer: ViewStyle
  signInPromptIcon: TextStyle
  signInPromptTitle: TextStyle
  signInPromptText: TextStyle
  footer: ViewStyle
  footerText: TextStyle
  tmdbLogo: ImageStyle
  linkText: TextStyle
}

const themedStyles = (theme: Theme): ProfileScreenStyles => ({
  scrollContentContainer: {
    padding: theme.spacing.medium,
    paddingTop:
      theme.responsive.platform === "ios"
        ? theme.responsive.scale(60)
        : theme.responsive.scale(30),
    alignItems: "center",
    paddingBottom: theme.responsive.scale(100),
  },
  contentArea: {
    width: "100%",
    maxWidth: theme.responsive.scale(500),
    alignSelf: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing.medium,
    paddingBottom: theme.spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    width: "100%",
  },
  title: {
    ...theme.typography.heading2,
    color: theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.medium,
  },
  signInPromptContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.large,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(12),
    width: "100%",
    maxWidth: theme.responsive.scale(500),
    marginBottom: theme.spacing.large,
  },
  signInPromptIcon: {
    fontSize: theme.responsive.scale(30),
    color: theme.colors.accentText,
  },
  signInPromptTitle: {
    ...theme.typography.heading2,
    color: theme.colors.accentText,
    marginTop: theme.spacing.medium,
    marginBottom: theme.spacing.small,
    textAlign: "center",
  },
  signInPromptText: {
    ...theme.typography.bodyText,
    textAlign: "center",
    marginBottom: theme.spacing.small,
  },
  footer: {
    padding: theme.spacing.medium,
    alignItems: "center",
    marginTop: theme.spacing.large,
    opacity: 0.9,
  },
  tmdbLogo: {
    width: theme.responsive.scale(120),
    height: theme.responsive.scale(50),
    marginBottom: theme.spacing.small,
  },
  footerText: {
    ...theme.typography.caption,
    textAlign: "center",
    marginBottom: theme.spacing.extraSmall,
    color: theme.colors.textSecondary,
    maxWidth: "90%",
  },
  linkText: {
    color: theme.colors.accentText,
    textDecorationLine: "underline",
    fontFamily: "Arvo-Bold",
  },
})

export default ProfileScreen
