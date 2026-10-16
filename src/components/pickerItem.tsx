import React, { memo, useEffect, useState, useId } from "react"
import {
  View,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native"
import { Image } from "expo-image"
import Svg, { Defs, Pattern, Rect, Text as SvgText } from "react-native-svg"
import { BasicTriviaItem, TriviaItem } from "../models/trivia"
import { API_CONFIG } from "../config/constants"
import { useTheme } from "../contexts/themeContext"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { releaseYear as getReleaseYear } from "../utils/dateDisplay"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

interface ItemProps {
  item: BasicTriviaItem
  detailedItem: TriviaItem | null
  isDisabled: boolean
  isGuessed?: boolean
  isExpanded: boolean
  onSelect: (item: BasicTriviaItem) => void
  onLongPress: (item: BasicTriviaItem) => void
}

const defaultPoster = require("../../assets/premiere/theatre.png")

// A small, stable emulsion pattern: no animation or random changes while typing.
function FilmGrain() {
  const id = `grain-${useId().replace(/:/g, "")}`
  return <View pointerEvents="none" accessible={false} aria-hidden style={{ position: "absolute", inset: 0, opacity: 0.18 }}>
    <Svg width="100%" height="100%">
      <Defs><Pattern id={id} patternUnits="userSpaceOnUse" width={83} height={79}>
        {Array.from({ length: 160 }, (_, i) => <Rect key={i} x={Math.abs(Math.sin(i * 127.1) * 43758.5453) % 83} y={Math.abs(Math.sin(i * 311.7) * 96453.1337) % 79}
          width={i % 3 ? 0.6 : 1} height={i % 4 ? 0.7 : 1.2} fill={i % 2 ? "#D6C5A1" : "#000000"} />)}
      </Pattern></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>
}

function FilmEdge({ side }: { side: "left" | "right" }) {
  const patternId = `film-${useId().replace(/:/g, "")}`
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, bottom: 0, [side]: 0, width: 14 }}>
    <Svg width="100%" height="100%" aria-hidden>
      <Defs><Pattern id={patternId} patternUnits="userSpaceOnUse" width={14} height={18}>
        <Rect x={3} y={4} width={8} height={11} rx={1.5} fill="#071A20" stroke="#806D49" strokeWidth={0.6} />
        <Rect x={4} y={5} width={6} height={8} rx={1} fill="#C8B993" opacity={0.75} />
      </Pattern></Defs>
      <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  </View>
}

const PickerItem = memo<ItemProps>(
  ({ item, detailedItem, isDisabled, isGuessed = false, isExpanded, onSelect, onLongPress }) => {
    const styles = useStyles(themedStyles)
    const { colors } = useTheme()
    const reduced = usePremiereMotion()
    const [failedPoster, setFailedPoster] = useState<string | null>(null)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
      if (Platform.OS !== "web" && !reduced) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
    }, [isExpanded, reduced])

    const year = getReleaseYear(item.releaseDate)
    const releaseYear = year ? ` (${year})` : ""
    const titleWithYear = `${item.title}${releaseYear}`

    const imageSource = item.posterPath && failedPoster !== item.posterPath
      ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W185}${item.posterPath}` }
      : defaultPoster
    const fullImageSource = item.posterPath && failedPoster !== item.posterPath
      ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${item.posterPath}` }
      : defaultPoster

    return (
      <View style={styles.resultItemContainer}>
        <Pressable
          testID={`result-item-${item.title}`}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isGuessed ? `${titleWithYear}. Already guessed.` : `Select and guess: ${titleWithYear}.`}
          accessibilityState={{ disabled: isDisabled || isGuessed }}
          onPress={() => onSelect(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={200}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          style={({ pressed }) => [
            styles.resultItem,
            (pressed || (hovered && !isDisabled && !isGuessed)) && styles.pressedItem,
            (isDisabled || isGuessed) && { opacity: 0.55 },
          ]}
          disabled={isDisabled || isGuessed}
        >
          <FilmEdge side="left" />
          <FilmEdge side="right" />
          <View pointerEvents="none" accessible={false} aria-hidden style={styles.yearStrip}>
            <Svg width={29} height={94} viewBox="0 0 29 94">
              <SvgText x={47} y={-11} transform="rotate(90)" textAnchor="middle"
                fontSize={9} letterSpacing={1.1} fill={colors.textSecondary}>{`YEAR - ${year || "UNKNOWN"}`}</SvgText>
            </Svg>
          </View>
          <View style={styles.resultItemContent}>
            <FilmGrain />
            <View style={styles.imageWrapper}>
              <Image
                source={imageSource}
                placeholder={defaultPoster}
                onError={() => setFailedPoster(item.posterPath)}
                style={styles.resultImage}
                contentFit="cover"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.unselected} numberOfLines={2}>{item.title}</Text>
              {isGuessed && <Text style={styles.expandedHint}>Already guessed</Text>}
            </View>
          </View>

          {isExpanded && detailedItem && (
            <View style={styles.expandedPreview}>
              <View style={styles.expandedImageWrapper}>
                <Image
                  source={fullImageSource}
                  placeholder={defaultPoster}
                  onError={() => setFailedPoster(item.posterPath)}
                  style={styles.expandedImage}
                  contentFit="cover"
                />
              </View>
              <View style={styles.expandedInfo}>
                <Text style={styles.expandedTitle}>
                  {detailedItem.title}
                </Text>
                <Text style={styles.expandedYear}>
                  Release Year:{" "}
                  {getReleaseYear(detailedItem.releaseDate) || "Unknown"}
                </Text>
                <Text style={styles.expandedHint}>
                  Select this movie to submit a guess.
                </Text>
              </View>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Preview: ${titleWithYear}`}
          accessibilityHint="Show or hide movie details without using a guess."
          aria-expanded={isExpanded}
          accessibilityState={{ expanded: isExpanded, disabled: isDisabled || isGuessed }}
          disabled={isDisabled || isGuessed}
          onPress={() => onLongPress(item)}
          style={({ pressed }) => [styles.previewButton, pressed && styles.pressedItem,
            (isDisabled || isGuessed) && { opacity: 0.55 }]}
        >
          <Text style={styles.expandedHint}>{isExpanded ? "Hide preview" : "Preview movie"}</Text>
        </Pressable>
      </View>
    )
  }
)

interface PickerItemStyles {
  resultItemContainer: ViewStyle
  resultItem: ViewStyle
  pressedItem: ViewStyle
  resultItemContent: ViewStyle
  imageWrapper: ViewStyle
  resultImage: ImageStyle
  unselected: TextStyle
  yearStrip: ViewStyle
  expandedPreview: ViewStyle
  expandedImageWrapper: ViewStyle
  expandedImage: ImageStyle
  expandedInfo: ViewStyle
  expandedTitle: TextStyle
  expandedYear: TextStyle
  expandedHint: TextStyle
  previewButton: ViewStyle
}

const themedStyles = (theme: Theme): PickerItemStyles => ({
  previewButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 17,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  resultItemContainer: {
    backgroundColor: theme.colors.backgroundLight,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  resultItem: {
    paddingVertical: 7,
    paddingLeft: 17,
    paddingRight: 44,
    minHeight: 108,
    overflow: "hidden",
  },
  pressedItem: {
    backgroundColor: theme.colors.surface,
  },
  resultItemContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 1,
    paddingRight: 9,
    minHeight: 92,
    overflow: "hidden",
  },
  imageWrapper: {
    width: 60,
    height: 90,
    borderRadius: 0,
    marginRight: 12,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  unselected: {
    ...theme.typography.bodyText,
    fontSize: theme.responsive.responsiveFontSize(18),
    lineHeight: 23,
    fontFamily: "PremiereClue",
    color: theme.colors.textPrimary,
  },
  yearStrip: {
    position: "absolute", right: 14, top: 7, width: 29, height: 94,
    borderTopWidth: 1, borderBottomWidth: 1, borderRightWidth: 1,
    borderColor: theme.colors.border, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  expandedPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.medium,
    padding: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expandedImageWrapper: {
    width: theme.responsive.scale(80),
    height: theme.responsive.scale(120),
    borderRadius: theme.responsive.scale(6),
    marginRight: theme.spacing.medium,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  expandedImage: {
    width: "100%",
    height: "100%",
  },
  expandedInfo: {
    flex: 1,
    justifyContent: "center",
  },
  expandedTitle: {
    ...theme.typography.bodyText,
    color: theme.colors.textPrimary,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(16),
    marginBottom: theme.spacing.extraSmall,
  },
  expandedYear: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.small,
  },
  expandedHint: {
    ...theme.typography.caption,
    color: theme.colors.accentText,
    fontFamily: "PremiereSans",
  },
})

export default PickerItem
