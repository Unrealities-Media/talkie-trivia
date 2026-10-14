import React, { memo, useEffect } from "react"
import {
  View,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native"
import { Image } from "expo-image"
import { BasicTriviaItem, TriviaItem } from "../models/trivia"
import { API_CONFIG } from "../config/constants"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { releaseYear as getReleaseYear } from "../utils/dateDisplay"

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface ItemProps {
  item: BasicTriviaItem
  detailedItem: TriviaItem | null
  isDisabled: boolean
  isGuessed?: boolean
  isExpanded: boolean
  onSelect: (item: BasicTriviaItem) => void
  onLongPress: (item: BasicTriviaItem) => void
}

const defaultPoster = require("../../assets/movie_default.png")

const PickerItem = memo<ItemProps>(
  ({ item, detailedItem, isDisabled, isGuessed = false, isExpanded, onSelect, onLongPress }) => {
    const styles = useStyles(themedStyles)

    useEffect(() => {
      if (Platform.OS !== "web") {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
    }, [isExpanded])

    const year = getReleaseYear(item.releaseDate)
    const releaseYear = year ? ` (${year})` : ""
    const titleWithYear = `${item.title}${releaseYear}`

    const imageSource = item.posterPath
      ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W92}${item.posterPath}` }
      : defaultPoster
    const fullImageSource = item.posterPath
      ? { uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${item.posterPath}` }
      : defaultPoster

    return (
      <View style={styles.resultItemContainer}>
        <Pressable
          testID={`result-item-${item.title}`}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isGuessed ? `${titleWithYear}. Already guessed.` : `Select and guess: ${titleWithYear}. Long press to preview.`}
          accessibilityState={{ disabled: isDisabled || isGuessed }}
          onPress={() => onSelect(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={200}
          style={({ pressed }) => [
            styles.resultItem,
            pressed && styles.pressedItem,
          ]}
          disabled={isDisabled || isGuessed}
        >
          <View style={styles.resultItemContent}>
            <View style={styles.imageWrapper}>
              <Image
                source={imageSource}
                placeholder={defaultPoster}
                style={styles.resultImage}
                contentFit="cover"
              />
            </View>
            <Text
              style={styles.unselected}
            >
              {titleWithYear}
              {isGuessed ? " — Already guessed" : ""}
            </Text>
          </View>

          {isExpanded && detailedItem && (
            <View style={styles.expandedPreview}>
              <View style={styles.expandedImageWrapper}>
                <Image
                  source={fullImageSource}
                  placeholder={defaultPoster}
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
                  Tap this item to select.
                </Text>
              </View>
            </View>
          )}
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
  expandedPreview: ViewStyle
  expandedImageWrapper: ViewStyle
  expandedImage: ImageStyle
  expandedInfo: ViewStyle
  expandedTitle: TextStyle
  expandedYear: TextStyle
  expandedHint: TextStyle
}

const themedStyles = (theme: Theme): PickerItemStyles => ({
  resultItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultItem: {
    paddingVertical: theme.spacing.small,
    paddingHorizontal: theme.spacing.medium,
    overflow: "hidden",
  },
  pressedItem: {
    backgroundColor: theme.colors.surface,
  },
  resultItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageWrapper: {
    width: theme.responsive.scale(30),
    height: theme.responsive.scale(45),
    borderRadius: theme.responsive.scale(4),
    marginRight: theme.spacing.medium,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  unselected: {
    ...theme.typography.bodyText,
    fontSize: theme.responsive.responsiveFontSize(14),
    flex: 1,
  },
  expandedPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.medium,
    padding: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(8),
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
    fontFamily: "Arvo-Bold",
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
    fontFamily: "Arvo-Italic",
  },
})

export default PickerItem
