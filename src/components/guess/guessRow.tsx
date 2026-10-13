import React, { memo } from "react"
import { Text, View, ViewStyle, TextStyle, StyleSheet } from "react-native"
import Animated from "react-native-reanimated"
import Ionicons from "@expo/vector-icons/Ionicons"
import { BasicTriviaItem } from "../../models/trivia"
import { Guess, HintInfo } from "../../models/game"
import { useStyles, Theme, useThemeTokens } from "../../utils/hooks/useStyles"
import { useGuessAnimation } from "../../utils/hooks/useGuessAnimation"
import { u } from "../../styles/utils"

type GuessResult = {
  itemId: number | string
  correct: boolean
  feedback?: string | null
  hintInfo?: HintInfo[] | null
} | null

interface GuessRowProps {
  index: number
  guess: Guess
  basicItems: readonly BasicTriviaItem[]
  isLastGuess: boolean
  lastGuessResult: GuessResult
  correctItemId: number | string
}

export const GuessRow = memo(
  ({
    index,
    guess,
    basicItems,
    isLastGuess,
    lastGuessResult,
    correctItemId,
  }: GuessRowProps) => {
    const theme = useThemeTokens()
    const styles = useStyles(themedStyles)

    const { animatedTileStyle, animatedContentStyle, animatedFeedbackStyle } =
      useGuessAnimation({
        isCorrect: guess.itemId === correctItemId,
        isLastGuess,
        lastGuessResult,
        theme,
      })

    const guessItem = basicItems.find(
      (item: BasicTriviaItem) => item.id === guess.itemId
    )
    const guessTitle = guessItem?.title || "Unknown Item"
    const releaseYear = guessItem?.releaseDate
      ? ` (${new Date(guessItem.releaseDate).getFullYear()})`
      : ""
    const isCorrect = guess.itemId === correctItemId
    const feedbackMessage =
      isLastGuess && !isCorrect ? lastGuessResult?.feedback : null
    const hintInfoList = guess.hintInfo

    const getIconNameForHint = (
      hintType: string
    ): keyof typeof Ionicons.glyphMap => {
      const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
        decade: "calendar-outline",
        director: "film-outline",
        developer: "game-controller-outline",
        actor: "person-outline",
        actors: "people-outline",
        genre: "folder-open-outline",
      }
      return iconMap[hintType] || "information-circle-outline"
    }

    const getHintDisplayValue = (hint: HintInfo): string => {
      if (
        hint.type === "actors" &&
        Array.isArray(hint.value) &&
        hint.value.length > 0
      ) {
        return hint.value[0].name
      }
      return String(hint.value)
    }

    return (
      <Animated.View style={[styles.guessTile, animatedTileStyle]}>
        {feedbackMessage && (
          <Animated.View
            style={[styles.feedbackOverlay, animatedFeedbackStyle]}
          >
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          </Animated.View>
        )}
        <Animated.View style={[styles.contentContainer, animatedContentStyle]}>
          <Text style={styles.guessNumber}>{index + 1}</Text>
          <Ionicons
            name={isCorrect ? "checkmark-circle" : "close-circle"}
            style={isCorrect ? styles.iconSuccess : styles.iconError}
          />
          <View style={styles.guessTextContainer}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.guessText}
            >
              {`${guessTitle}${releaseYear}`}
            </Text>
            {hintInfoList && hintInfoList.length > 0 && (
              <View style={styles.hintsWrapper}>
                {hintInfoList.map((hint, idx) => (
                  <View key={idx} style={styles.guessHintContainer}>
                    <Ionicons
                      name={getIconNameForHint(hint.type)}
                      style={styles.guessHintIcon}
                    />
                    <Text style={styles.guessHintText} numberOfLines={1}>
                      {getHintDisplayValue(hint)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    )
  }
)

interface GuessRowStyles {
  guessTile: ViewStyle
  feedbackOverlay: ViewStyle
  feedbackText: TextStyle
  contentContainer: ViewStyle
  guessNumber: TextStyle
  iconSuccess: TextStyle
  iconError: TextStyle
  guessTextContainer: ViewStyle
  guessText: TextStyle
  hintsWrapper: ViewStyle
  guessHintContainer: ViewStyle
  guessHintIcon: TextStyle
  guessHintText: TextStyle
}

const themedStyles = (theme: Theme): GuessRowStyles => ({
  guessTile: {
    ...u.flexRow,
    ...u.alignCenter,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(8),
    paddingHorizontal: theme.spacing.medium,
    minHeight: theme.responsive.scale(44),
    marginBottom: theme.spacing.small,
    paddingVertical: theme.spacing.small,
    position: "relative",
    overflow: "hidden",
    ...theme.shadows.light,
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.tertiary,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.small,
    zIndex: 1,
  },
  feedbackText: {
    color: theme.colors.background,
    fontFamily: "Arvo-Bold",
    fontSize: theme.responsive.responsiveFontSize(14),
    textAlign: "center",
  },
  contentContainer: {
    ...u.flexRow,
    ...u.alignCenter,
    ...u.wFull,
  },
  guessNumber: {
    color: theme.colors.textSecondary,
    fontFamily: "Arvo-Bold",
    fontSize: theme.responsive.responsiveFontSize(14),
    marginRight: theme.spacing.small,
  },
  iconSuccess: {
    marginRight: theme.spacing.medium,
    fontSize: theme.responsive.responsiveFontSize(22),
    color: theme.colors.success,
  },
  iconError: {
    marginRight: theme.spacing.medium,
    fontSize: theme.responsive.responsiveFontSize(22),
    color: theme.colors.error,
  },
  guessTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  guessText: {
    ...theme.typography.bodyText,
    color: theme.colors.textPrimary,
    fontSize: theme.responsive.responsiveFontSize(14),
    lineHeight: theme.responsive.responsiveFontSize(18),
  },
  hintsWrapper: {
    ...u.flexRow,
    flexWrap: "wrap",
    marginTop: theme.spacing.extraSmall,
  },
  guessHintContainer: {
    ...u.flexRow,
    ...u.alignCenter,
    marginRight: theme.spacing.medium,
  },
  guessHintIcon: {
    marginRight: theme.spacing.extraSmall,
    fontSize: theme.responsive.responsiveFontSize(12),
    color: theme.colors.primary,
    opacity: 0.8,
  },
  guessHintText: {
    fontFamily: "Arvo-Bold",
    fontSize: theme.responsive.responsiveFontSize(11),
    color: theme.colors.primary,
  },
})
