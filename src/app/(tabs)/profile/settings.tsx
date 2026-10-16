import React from "react"
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
import LoadingIndicator from "../../../components/loadingIndicator"
import { useAuth } from "../../../contexts/authContext"
import ErrorMessage from "../../../components/errorMessage"
import ProfileSection from "../../../components/profileSection"
import { useStyles, Theme } from "../../../utils/hooks/useStyles"
import { useTheme } from "../../../contexts/themeContext"
import { useExternalLink } from "../../../utils/hooks/useExternalLink"
import { u } from "../../../styles/utils"
import Constants from "expo-constants"

// Keep settings available when an already-open app loses connectivity. Loading
// these controls on first visit can otherwise crash the entire web app offline.
import GoogleLogin from "../../../components/googleLogin"
import AccountDeletion from "../../../components/accountDeletion"
import AccountMerge from "../../../components/accountMerge"
import SessionRecovery from "../../../components/sessionRecovery"
import GuestArchive from "../../../components/guestArchive"
import ThemeSelector from "../../../components/themeSelector"
import ReminderSettings from "../../../components/reminderSettings"

const Footer = () => {
  const styles = useStyles(themedStyles)
  const { openLink } = useExternalLink()
  const version = Constants.expoConfig?.version || "1.0.0"
  const tmdbLogo = require("../../../../assets/tmdb_blue_square.svg")

  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Version {version}</Text>

      <Image source={tmdbLogo} style={styles.tmdbLogo} contentFit="contain" />
      <Text style={styles.footerText}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>

      {Constants.expoConfig?.extra?.publicSiteUrl && [
        ["Privacy Policy", "privacy"], ["Support", "support"], ["Delete account help", "delete-account"],
      ].map(([label, route]) => <Pressable key={route} accessibilityRole="link"
        onPress={() => openLink(`${Constants.expoConfig?.extra?.publicSiteUrl.replace(/\/$/, "")}/${route}`)}
        style={u.mtSm}><Text style={[styles.footerText, styles.linkText]}>{label}</Text></Pressable>)}
    </View>
  )
}

const SettingsScreen: React.FC = () => {
  const { player, user, deletion, merge, mergeProposal, lostSession, loading: authLoading, error: authError, retryAuthentication } = useAuth()
  const styles = useStyles(themedStyles)
  const { colors } = useTheme()

  const isGoogleSignedIn = player && user && !user.isAnonymous
  const isUserAuthenticated = player && user

  const displayName = player?.name && !["Player", "Guest"].includes(player.name) ? player.name : null

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
            <View style={styles.contentArea}>
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>Account settings</Text>
                <Text style={styles.welcome}>{displayName ? `Welcome back, ${displayName}.` : "Your life in movies, one challenge at a time."}</Text>
              </View>

              {authLoading && <LoadingIndicator message="Opening your player account…" />}
              {(merge || mergeProposal) && <AccountMerge />}
              {!authLoading && lostSession && !deletion && <SessionRecovery />}
              {!authLoading && !isUserAuthenticated && !deletion && !lostSession && !merge && !mergeProposal && <ErrorMessage message={authError || "Your player account could not be opened."} onRetry={retryAuthentication} />}
              {isUserAuthenticated && !isGoogleSignedIn && (
                <View style={styles.signInPromptContainer}>
                  <Text style={styles.signInPromptTitle}>
                    Link Your Guest Account
                  </Text>
                  <Text style={styles.signInPromptText}>
                    Your guest progress is already saved. Link a Google account to keep access across devices or after reinstalling. Signing in is optional. If that Google account already has progress, you can open it instead; guest games will stay separate.
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
                <ThemeSelector />
                <View style={styles.divider} />
                <ReminderSettings suspended={authLoading || !!deletion} />
              </ProfileSection>

              {!merge && !mergeProposal && (user || deletion) && <ProfileSection title="Account deletion" icon="trash"><AccountDeletion /></ProfileSection>}

              {isGoogleSignedIn && <ProfileSection title="Preserved guest games" icon="archive">
                <GuestArchive uid={player.id} />
              </ProfileSection>}

              <Footer />
            </View>
        </ScrollView>
      </LinearGradient>

    </>
  )
}

interface ProfileScreenStyles {
  scrollContentContainer: ViewStyle
  contentArea: ViewStyle
  header: ViewStyle
  title: TextStyle
  welcome: TextStyle
  divider: ViewStyle
  signInPromptContainer: ViewStyle
  signInPromptTitle: TextStyle
  signInPromptText: TextStyle
  footer: ViewStyle
  footerText: TextStyle
  tmdbLogo: ImageStyle
  linkText: TextStyle
}

const themedStyles = (theme: Theme): ProfileScreenStyles => ({
  scrollContentContainer: {
    padding: 20,
    paddingTop: 30,
    alignItems: "center",
    paddingBottom: 32,
  },
  contentArea: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    width: "100%",
  },
  title: {
    fontFamily: "PremiereDisplay",
    fontSize: 40,
    lineHeight: 48,
    color: theme.colors.textPrimary,
  },
  welcome: {
    fontFamily: "PremiereSans",
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.medium,
  },
  signInPromptContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: "100%",
    maxWidth: 420,
    marginBottom: theme.spacing.large,
  },
  signInPromptTitle: {
    fontFamily: "PremiereDisplay",
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.textPrimary,
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
    fontFamily: "PremiereSans",
  },
})

export default SettingsScreen
