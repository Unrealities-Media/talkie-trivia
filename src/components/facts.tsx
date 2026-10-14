import React, { useCallback, useState, memo } from "react"
import {
  Pressable,
  View,
  ActivityIndicator,
  ScrollView,
  ViewStyle,
  TextStyle,
  ImageStyle,
  useWindowDimensions,
  PixelRatio,
} from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "../contexts/themeContext"
import { FontAwesome } from "@expo/vector-icons"
import { TriviaItem } from "../models/trivia"
import { analyticsService } from "../utils/analyticsService"
import { useExternalLink } from "../utils/hooks/useExternalLink"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { u } from "../styles/utils"
import { Typography } from "./ui/typography"
import Actors from "./actors"
import { API_CONFIG } from "../config/constants"
import { imdbPersonUrl, imdbTitleUrl } from "../utils/imdbLinks"
import { releaseYear } from "../utils/dateDisplay"
import PremierePosterGrade from "./premierePosterGrade"
import PremierePosterNotes from "./premierePosterNotes"

type ImageSource = { uri: string } | number
const defaultItemImage = require("../../assets/premiere/theatre.png")

const InlineActors = ({ actors }: { actors: any[] }) => {
  const styles = useStyles(themedStyles)
  // Take top 3
  const topActors = actors
    .slice(0, 3)
    .map((a) => a.name)
    .join(", ")
  return (
    <Typography variant="caption" style={styles.inlineActors}>
      Starring: {topActors}
    </Typography>
  )
}

const ItemHeader = memo(
  ({
    title,
    onPress,
    isLinkable,
    compact = false,
    premiere = false,
  }: {
    title: string
    onPress: () => void
    isLinkable: boolean
    compact?: boolean
    premiere?: boolean
  }) => {
    const styles = useStyles(themedStyles)
    const { width } = useWindowDimensions()
    const premiereTitleSize = PixelRatio.roundToNearestPixel(Math.min(40, Math.max(30, width * 0.0866)))
    if (premiere) {
      const heading = <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, width: "100%" }}>
        <View accessible={false} style={{ width: 32, height: 1, backgroundColor: "#FF7868", flexShrink: 1 }} />
        <Typography accessibilityRole="header" variant="h1" style={[styles.header, styles.headerPremiere, { flexShrink: 1, fontSize: premiereTitleSize, lineHeight: PixelRatio.roundToNearestPixel(premiereTitleSize * 1.2) }]}>{title}</Typography>
        <View accessible={false} style={{ width: 32, height: 1, backgroundColor: "#FF7868", flexShrink: 1 }} />
      </View>
      return isLinkable
        ? <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`Open IMDb page for ${title}`}
            style={({ pressed }) => [styles.headerPressable, { opacity: pressed ? 0.7 : 1 }]}>{heading}</Pressable>
        : <View style={styles.headerPressable}>{heading}</View>
    }
    if (!isLinkable) return <Typography accessibilityRole="header" variant="h1" style={[styles.header, premiere && styles.headerPremiere, compact && styles.headerCompact]}>{title}</Typography>
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.headerPressable,
          compact && styles.headerPressableCompact,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        disabled={!isLinkable}
        accessible={isLinkable}
        accessibilityLabel={`Open IMDb page for ${title}`}
        role="link"
      >
        <View
          style={[
            styles.headerContainer,
            compact && styles.headerContainerCompact,
          ]}
        >
          <Typography
            variant="h1"
            style={[
              styles.header,
              premiere && styles.headerPremiere,
              isLinkable && !premiere && styles.linkText,
              compact && styles.headerCompact,
            ]}
          >
            {title}
          </Typography>
          {isLinkable && !premiere && (
            <FontAwesome
              name="external-link-square"
              size={compact ? 16 : styles.imdbIcon.fontSize}
              color={styles.imdbIcon.color}
              style={[styles.imdbIcon, compact && styles.imdbIconCompact]}
            />
          )}
        </View>
      </Pressable>
    )
  }
)

interface FactsProps {
  item: TriviaItem
  isLoading?: boolean
  error?: string
  isScrollEnabled?: boolean
  compact?: boolean
  posterFooter?: React.ReactNode
  headerFooter?: React.ReactNode
}

const Facts = memo(
  ({
    item,
    isLoading = false,
    error,
    isScrollEnabled = true,
    compact = false,
    posterFooter,
    headerFooter,
  }: FactsProps) => {
    const styles = useStyles(themedStyles)
    const { colors } = useTheme()
    const { width } = useWindowDimensions()
    const { openLink } = useExternalLink()
    const titleUrl = imdbTitleUrl(item.metadata.imdb_id)
    const year = releaseYear(item.releaseDate)
    const [failedPoster, setFailedPoster] = useState<string | null>(null)

    const handleItemPress = useCallback(() => {
      if (titleUrl) {
        analyticsService.trackImdbLinkTapped(item.title)
        openLink(titleUrl)
      }
    }, [openLink, item.title, titleUrl])

    const handleActorPress = useCallback(
      (actor: any) => {
        const url = imdbPersonUrl(actor.imdb_id)
        if (url) {
          analyticsService.trackActorLinkTapped(actor.name)
          openLink(url)
        }
      },
      [openLink]
    )

    if (isLoading)
      return (
        <ActivityIndicator
          testID="activity-indicator"
          size="large"
          color={styles.loadingIndicator.color}
        />
      )
    if (error)
      return (
        <View style={u.pMd}>
          <Typography variant="error">{error}</Typography>
        </View>
      )

    const imageSource = item.posterPath && failedPoster !== item.posterPath
      ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${item.posterPath}` }
      : defaultItemImage

    const renderCompactLayout = () => (
      <View style={styles.compactContainer}>
        <View style={styles.compactTopRow}>
          {/* LEFT COLUMN: POSTER */}
          <Image
            source={imageSource}
            style={styles.posterImageCompact}
            contentFit="contain"
            placeholder={defaultItemImage}
            onError={() => setFailedPoster(item.posterPath)}
          />

          {/* RIGHT COLUMN: DETAILS */}
          <View style={styles.compactInfo}>
            <ItemHeader
              title={item.title}
              onPress={handleItemPress}
              isLinkable={!!titleUrl}
              compact
            />

            {/* Tagline */}
            {item.metadata.tagline && (
              <Typography
                variant="caption"
                style={styles.taglineCompact}
                numberOfLines={3}
              >
                "{item.metadata.tagline}"
              </Typography>
            )}

            {/* Metadata Block */}
            <View style={styles.metadataBlock}>
              {/* Director */}
              {item.hints.map((h) => {
                if (h.type === "director") {
                  return (
                    <Typography
                      key="dir"
                      variant="caption"
                      style={styles.metadataText}
                    >
                      Dir: {String(h.value)}
                    </Typography>
                  )
                }
                return null
              })}

              {year && <Typography variant="caption" style={styles.metadataText}>Released: {year}</Typography>}
              {/* Use a decade only when an exact release year is unavailable. */}
              {item.hints.map((h) => {
                if (h.type === "decade" && !year) {
                  return (
                    <Typography
                      key="dec"
                      variant="caption"
                      style={styles.metadataText}
                    >
                      Decade: {String(h.value)}
                    </Typography>
                  )
                }
                return null
              })}

              {/* Genre */}
              {item.hints.map((h) => {
                if (h.type === "genre") {
                  return (
                    <Typography
                      key="gen"
                      variant="caption"
                      style={styles.metadataText}
                    >
                      Genre: {String(h.value)}
                    </Typography>
                  )
                }
                return null
              })}
            </View>

            {/* Actors (Inline Text) */}
            {item.hints.map((h) => {
              if (h.type === "actors" && Array.isArray(h.value)) {
                return <InlineActors key="actors" actors={h.value} />
              }
              return null
            })}
          </View>
        </View>
      </View>
    )

    const renderStandardLayout = () => (
      <>
        <ItemHeader
          title={item.title}
          onPress={handleItemPress}
          isLinkable={!!titleUrl}
          premiere={!!posterFooter}
        />
        {headerFooter}
        {!posterFooter && item.metadata.tagline && (
          <Typography variant="caption" style={styles.tagline}>
            {item.metadata.tagline}
          </Typography>
        )}
        {posterFooter ? <View style={{ alignSelf: "stretch", marginHorizontal: -20, height: Math.min(340, width * 0.8), overflow: "hidden" }}>
          <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ left: "50%", top: "25%" }} onError={() => setFailedPoster(item.posterPath)} />
          <PremierePosterGrade />
          <LinearGradient pointerEvents="none" colors={[colors.background, "transparent", "transparent", colors.background]} locations={[0, 0.14, 0.72, 1]} style={{ position: "absolute", inset: 0 }} />
          <PremierePosterNotes />
        </View> : <Image source={imageSource} style={styles.posterImage} contentFit="cover" onError={() => setFailedPoster(item.posterPath)} />}
        {posterFooter}
        {posterFooter && item.metadata.tagline && <Typography variant="caption" style={styles.tagline}>{item.metadata.tagline}</Typography>}
        {year && <Typography style={styles.director}>Released: {year}</Typography>}
        {item.hints.map((hint) => {
          if (hint.type === "actors" && Array.isArray(hint.value)) {
            return (
              <Actors
                key={hint.type}
                actors={hint.value}
                onActorPress={handleActorPress}
              />
            )
          }
          if (["director", "genre", "decade"].includes(hint.type)) {
            return (
              <Typography
                key={hint.type}
                variant="caption"
                style={styles.director}
              >
                {hint.label}: {String(hint.value)}
              </Typography>
            )
          }
          return null
        })}
      </>
    )

    return (
      <View style={styles.container}>
        {compact ? (
          renderCompactLayout()
        ) : isScrollEnabled ? (
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {renderStandardLayout()}
          </ScrollView>
        ) : (
          <View style={styles.staticContent}>{renderStandardLayout()}</View>
        )}
      </View>
    )
  }
)

interface FactsStyles {
  container: ViewStyle
  headerContainer: ViewStyle
  headerContainerCompact: ViewStyle
  header: TextStyle
  headerPremiere: TextStyle
  headerCompact: TextStyle
  imdbIcon: TextStyle & { fontSize: number }
  imdbIconCompact: TextStyle
  inlineActors: TextStyle & { fontSize: number }
  linkText: TextStyle
  tagline: TextStyle
  taglineCompact: TextStyle
  director: TextStyle
  scrollContainer: ViewStyle
  staticContent: ViewStyle
  posterImage: ImageStyle
  posterImageCompact: ImageStyle
  headerPressable: ViewStyle
  headerPressableCompact: ViewStyle
  loadingIndicator: { color: string }
  metadataBlock: ViewStyle
  metadataText: TextStyle & { fontSize: number }
  compactContainer: ViewStyle
  compactTopRow: ViewStyle
  compactInfo: ViewStyle
}

const themedStyles = (theme: Theme): FactsStyles => ({
  container: {
    width: "100%",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  headerContainerCompact: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  header: {
    ...theme.typography.heading1,
    fontSize: theme.responsive.responsiveFontSize(24),
    paddingBottom: theme.spacing.medium,
    textAlign: "center",
  },
  headerCompact: {
    fontFamily: "PremiereDisplay",
    fontSize: 24,
    lineHeight: 30,
    paddingBottom: theme.spacing.extraSmall,
    textAlign: "left",
  },
  headerPremiere: {
    fontFamily: "PremiereDisplay",
    fontSize: 40,
    lineHeight: 48,
    paddingBottom: 4,
    textAlign: "center",
  },
  linkText: {
    textDecorationLine: "underline",
  },
  imdbIcon: {
    marginLeft: theme.spacing.small,
    paddingBottom: theme.spacing.small,
    fontSize: theme.responsive.scale(22),
    color: theme.colors.accentText,
  },
  imdbIconCompact: {
    paddingBottom: 0,
    marginLeft: theme.spacing.extraSmall,
  },
  tagline: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
    textAlign: "center",
    width: "90%",
    marginBottom: theme.spacing.small,
    color: theme.colors.accentText,
    fontStyle: "italic",
  },
  director: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
    textAlign: "center",
    width: "90%",
    marginBottom: theme.spacing.small,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.medium,
    paddingBottom: theme.spacing.large,
  },
  staticContent: {
    width: "100%",
    alignItems: "center",
    paddingBottom: theme.spacing.small,
  },
  posterImage: {
    width: theme.responsive.scale(240),
    maxWidth: "100%",
    height: undefined,
    aspectRatio: 2 / 3,
    marginBottom: theme.spacing.medium,
    borderRadius: 2,
  },
  headerPressable: {
    width: "100%",
    alignItems: "center",
    paddingVertical: theme.spacing.small,
  },
  headerPressableCompact: {
    alignItems: "flex-start",
    paddingVertical: 0,
  },
  loadingIndicator: {
    color: theme.colors.accentText,
  },

  // Compact Layout
  compactContainer: {
    width: "100%",
    flexDirection: "column",
  },
  compactTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: theme.spacing.small,
  },
  posterImageCompact: {
    width: theme.responsive.scale(100),
    height: theme.responsive.scale(150),
    borderRadius: 3,
    marginRight: theme.spacing.medium,
    backgroundColor: theme.colors.surface,
  },
  compactInfo: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: theme.spacing.extraSmall,
  },
  taglineCompact: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(11),
    color:
      theme.colorScheme === "dark" ? "#E0E0E0" : theme.colors.textSecondary,
    marginBottom: theme.spacing.small,
  },
  metadataBlock: {
    flexDirection: "column",
    marginBottom: theme.spacing.small,
  },
  metadataText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(12),
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  inlineActors: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(11),
    color:
      theme.colorScheme === "dark" ? "#CCCCCC" : theme.colors.textSecondary,
    marginTop: theme.spacing.extraSmall,
  },
})

export default Facts
