import React, { memo } from "react"
import { Text, View, ViewStyle, TextStyle, StyleSheet } from "react-native"
import Animated from "react-native-reanimated"
import { Image } from "expo-image"
import Ionicons from "@expo/vector-icons/Ionicons"
import { BasicTriviaItem } from "../../models/trivia"
import { Guess, HintInfo } from "../../models/game"
import { useStyles, Theme, useThemeTokens } from "../../utils/hooks/useStyles"
import { useGuessAnimation } from "../../utils/hooks/useGuessAnimation"
import { u } from "../../styles/utils"
import { releaseYear as getReleaseYear } from "../../utils/dateDisplay"

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
    const year = getReleaseYear(guessItem?.releaseDate)
    const releaseYear = year ? ` (${year})` : ""
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
        <Image source={require("../../../assets/premiere/ticket.png")} contentFit="fill" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(35, 30, 24, 0.25)" }]} />
        {Array.from({ length: 12 }, (_, notch) => <React.Fragment key={notch}>
          <View pointerEvents="none" style={{ position: "absolute", left: -4, top: notch * 12 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.background }} />
          <View pointerEvents="none" style={{ position: "absolute", right: -4, top: notch * 12 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.background }} />
        </React.Fragment>)}
        {feedbackMessage && (
          <Animated.View
            style={[styles.feedbackOverlay, animatedFeedbackStyle]}
          >
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          </Animated.View>
        )}
        <Animated.View style={[styles.contentContainer, animatedContentStyle]}>
          <View style={styles.guessTextContainer}>
            <Text
              style={styles.guessText}
            >
              {`${guessTitle}${releaseYear}`}
            </Text>
            <Text style={styles.guessNumber}>GUESS {String(index + 1).padStart(2, "0")}</Text>
            {hintInfoList && hintInfoList.length > 0 && (
              <View style={styles.hintsWrapper}>
                {hintInfoList.map((hint, idx) => (
                  <View key={idx} style={styles.guessHintContainer}>
                    <Ionicons
                      name={getIconNameForHint(hint.type)}
                      style={styles.guessHintIcon}
                    />
                    <Text style={styles.guessHintText}>
                      {getHintDisplayValue(hint)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: isCorrect ? "#8AD4B2" : "#FF8973" }}>
              <Ionicons name={isCorrect ? "checkmark" : "close"} style={isCorrect ? styles.iconSuccess : styles.iconError} />
            </View>
            <Text style={{ fontFamily: "PremiereSans", fontSize: 15, color: isCorrect ? "#163D30" : "#542018" }}>{isCorrect ? "Correct" : "Incorrect"}</Text>
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
    backgroundColor: "#DED7C9",
    borderRadius: 3,
    borderWidth: 0,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    paddingHorizontal: 24,
    minHeight: 86,
    marginHorizontal: 5,
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
    color: theme.colors.onAccent,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
    textAlign: "center",
  },
  contentContainer: {
    ...u.flexRow,
    ...u.alignCenter,
    ...u.wFull,
  },
  guessNumber: {
    color: "#4F5354",
    fontFamily: "PremiereSans",
    fontSize: 8,
    letterSpacing: 2.4,
    marginTop: 8,
    marginRight: theme.spacing.small,
    borderRightWidth: 0,
    borderRightColor: theme.colors.border,
    paddingRight: 12,
  },
  iconSuccess: {
    marginRight: 0,
    fontSize: theme.responsive.responsiveFontSize(22),
    color: theme.colors.success,
  },
  iconError: {
    marginRight: 0,
    fontSize: theme.responsive.responsiveFontSize(22),
    color: "#A3362E",
  },
  guessTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  guessText: {
    ...theme.typography.bodyText,
    color: "#14232A",
    fontFamily: "PremiereClue",
    fontSize: 25,
    lineHeight: 28,
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
    maxWidth: "100%",
  },
  guessHintIcon: {
    marginRight: theme.spacing.extraSmall,
    fontSize: theme.responsive.responsiveFontSize(12),
    color: theme.colors.accentText,
  },
  guessHintText: {
    flexShrink: 1,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(11),
    color: theme.colors.accentText,
  },
})
