import React, { memo } from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useHintLogic } from "../utils/hooks/useHintLogic"
import HintUI from "./hintUI"
import { useSkeletonAnimation } from "../utils/hooks/useSkeletonAnimation"
import { useGameStore } from "../state/gameStore"
import { HintType } from "../models/game"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { useShallow } from "zustand/react/shallow"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"

const HintSkeleton = memo(() => {
  const styles = useStyles(themedStyles)
  const animatedStyle = useSkeletonAnimation()
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.skeletonLabel, animatedStyle]} />
    </View>
  )
})

const BasicHints = memo(() => {
  const { getHintText } = useHintLogic()
  const styles = useStyles(themedStyles)

  const hintTypes: HintType[] = ["decade", "director", "actors", "genre"]

  return (
    <View style={styles.basicHintsContainer}>
      <Typography variant="h2" style={styles.basicHintsTitle}>
        All Hints Revealed
      </Typography>
      {hintTypes.map((type) => (
        <View key={type} style={styles.basicHintsRow}>
          <Typography style={styles.basicHintsLabel}>
            {type.charAt(0).toUpperCase() + type.slice(1)}:
          </Typography>
          <Typography style={styles.basicHintsValue}>
            {getHintText(type)}
          </Typography>
        </View>
      ))}
    </View>
  )
})

const MainHintComponent = () => {
  const { playerStats } = useGameStore(
    useShallow((state) => ({
      playerStats: state.playerStats,
    }))
  )

  const {
    showHintOptions,
    hintLabelText,
    isToggleDisabled,
    hintStatuses,
    highlightedHint,
    handleToggleHintOptions,
    handleHintSelection,
    displayedHintText,
    displayedHintType,
    allHints,
  } = useHintLogic()
  const styles = useStyles(themedStyles)

  if (!hintLabelText) return null

  // Implicit Feedback mode only shows the label.
  if (
    DIFFICULTY_MODES[useGameStore.getState().difficulty].hintStrategy ===
      "IMPLICIT_FEEDBACK"
  ) {
    return (
      <View style={styles.container}>
        <Typography variant="caption" style={styles.hintLabelDisabled}>
          {hintLabelText}
        </Typography>
      </View>
    )
  }

  return (
    <HintUI
      showHintOptions={showHintOptions}
      displayedHintText={displayedHintType === "genre" || displayedHintType === "decade" ? null : displayedHintText}
      hintLabelText={hintLabelText}
      isToggleDisabled={isToggleDisabled}
      hintsAvailable={playerStats?.hintsAvailable ?? 0}
      hintStatuses={hintStatuses}
      highlightedHint={highlightedHint}
      handleToggleHintOptions={handleToggleHintOptions}
      handleHintSelection={handleHintSelection}
      allHints={allHints}
    />
  )
}

const HintContainer: React.FC = memo(() => {
  const { loading, isInteractionsDisabled, difficulty } = useGameStore(
    useShallow((state) => ({
      loading: state.loading,
      isInteractionsDisabled: state.isInteractionsDisabled,
      difficulty: state.difficulty,
    }))
  )

  if (loading) {
    return <HintSkeleton />
  }

  const currentStrategy = DIFFICULTY_MODES[difficulty]?.hintStrategy
  if (
    currentStrategy === "NONE_DISABLED" ||
    currentStrategy === "EXTREME_CHALLENGE"
  ) {
    return null
  }

  if (
    (currentStrategy === "ALL_REVEALED" ||
      currentStrategy === "HINTS_ONLY_REVEALED") &&
    !isInteractionsDisabled
  ) {
    return <BasicHints />
  }

  return <MainHintComponent />
})

interface HintStyles {
  container: ViewStyle
  skeletonLabel: ViewStyle
  hintLabelDisabled: TextStyle
  basicHintsContainer: ViewStyle
  basicHintsTitle: TextStyle
  basicHintsRow: ViewStyle
  basicHintsLabel: TextStyle
  basicHintsValue: TextStyle
}

const themedStyles = (theme: Theme): HintStyles => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.responsive.scale(2),
    width: "100%",
  },
  skeletonLabel: {
    backgroundColor: theme.colors.surface,
    height: theme.responsive.scale(20),
    width: "50%",
    borderRadius: theme.responsive.scale(4),
    marginVertical: theme.spacing.small,
  },
  hintLabelDisabled: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontFamily: "PremiereSans",
    textAlign: "center",
    paddingVertical: theme.spacing.small,
  },
  basicHintsContainer: {
    width: "90%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(8),
    padding: theme.spacing.medium,
    marginVertical: theme.spacing.small,
  },
  basicHintsTitle: {
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.accentText,
    textAlign: "center",
    marginBottom: theme.spacing.medium,
  },
  basicHintsRow: {
    alignItems: "stretch",
    paddingVertical: theme.spacing.extraSmall,
  },
  basicHintsLabel: {
    ...theme.typography.bodyText,
    fontFamily: "PremiereDisplay",
    color: theme.colors.textPrimary,
  },
  basicHintsValue: {
    ...theme.typography.bodyText,
  },
})

export default HintContainer
