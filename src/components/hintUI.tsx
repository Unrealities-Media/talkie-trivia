import React, { memo } from "react"
import { View, Pressable, ViewStyle, TextStyle } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { HintType } from "../models/game"
import HintButton from "./hintButton"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { Hint } from "../models/trivia"
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

type HintStatus = "available" | "used" | "disabled"

// A map to associate hint types with specific icons.
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  decade: "calendar-outline",
  director: "film-outline",
  actor: "person-outline",
  actors: "people-outline",
  genre: "folder-open-outline",
  developer: "game-controller-outline",
  platform: "hardware-chip-outline",
  default: "information-circle-outline",
}

interface HintUIProps {
  showHintOptions: boolean
  displayedHintText: string | null
  hintLabelText: string
  isToggleDisabled: boolean
  hintsAvailable: number
  hintStatuses: Record<string, HintStatus>
  highlightedHint: string | null
  handleToggleHintOptions: () => void
  handleHintSelection: (type: HintType) => void
  allHints: Hint[]
}

const HintUI: React.FC<HintUIProps> = memo(
  ({
    showHintOptions,
    displayedHintText,
    hintLabelText,
    isToggleDisabled,
    hintsAvailable,
    hintStatuses,
    highlightedHint,
    handleToggleHintOptions,
    handleHintSelection,
    allHints,
  }) => {
    const styles = useStyles(themedStyles)
    const reduced = usePremiereMotion()

    return (
      <View style={styles.container}>
        <Pressable
          onPress={handleToggleHintOptions}
          disabled={isToggleDisabled}
          accessible={true}
          accessibilityRole="button"
          accessibilityState={{ disabled: isToggleDisabled, expanded: showHintOptions }}
          aria-expanded={showHintOptions}
          accessibilityLabel={hintLabelText}
          style={styles.toggle}
        >
          <Ionicons name="bulb-outline" size={20} color={styles.hintLabel.color} />
          <Typography
            variant="body"
            style={[
              styles.hintLabel,
              isToggleDisabled && styles.hintLabelDisabled,
            ]}
          >
            {hintsAvailable > 0 ? `Hint · ${hintsAvailable} left` : hintLabelText}
          </Typography>
        </Pressable>

        {showHintOptions && <Animated.View entering={FadeInDown.duration(300).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={styles.hintButtonsContainer}>
          <View style={styles.hintButtonArea}>
            {allHints.map((hint) => (
              <HintButton
                key={hint.type}
                hintType={hint.type}
                iconName={ICON_MAP[hint.type] || ICON_MAP.default}
                label={hint.label}
                onPress={handleHintSelection}
                status={hintStatuses[hint.type]}
                accessibilityHintCount={hintsAvailable}
                isHighlighted={highlightedHint === hint.type}
              />
            ))}
          </View>
        </Animated.View>}

        {displayedHintText && (
          <Animated.View testID="revealed-hint-chip" key={displayedHintText} entering={FadeInDown.duration(450).reduceMotion(reduced ? ReduceMotion.Always : ReduceMotion.Never)} style={styles.displayedHintContainer}>
            <View style={styles.displayedHintContent}>
              <Ionicons name="bulb-outline" style={styles.displayedHintIcon} />
              <Typography style={styles.hintText} accessibilityLiveRegion="polite">
                {displayedHintText}
              </Typography>
            </View>
          </Animated.View>
        )}
      </View>
    )
  }
)

interface HintUIStyles {
  container: ViewStyle
  toggle: ViewStyle
  hintLabel: TextStyle
  hintLabelDisabled: TextStyle
  hintButtonsContainer: ViewStyle
  hintButtonArea: ViewStyle
  displayedHintContainer: ViewStyle
  displayedHintContent: ViewStyle
  displayedHintIcon: TextStyle
  hintText: TextStyle
}

const themedStyles = (theme: Theme): HintUIStyles => ({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.responsive.scale(2),
    width: "100%",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.textPrimary,
    borderRadius: 28,
    alignSelf: "center",
    minHeight: 44,
    minWidth: 188,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  hintLabel: {
    ...theme.typography.bodyText,
    fontFamily: "PremiereSans",
    color: theme.colors.textPrimary,
    fontSize: 15,
    marginVertical: theme.responsive.scale(4),
    textAlign: "center",
    paddingVertical: theme.responsive.scale(4),
  },
  hintLabelDisabled: {
    color: theme.colors.textSecondary,
  },
  hintButtonsContainer: {
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  hintButtonArea: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    width: "100%",
  },
  displayedHintContainer: {
    marginTop: theme.spacing.small,
    padding: theme.responsive.scale(2),
    backgroundColor: "#E5DCC3",
    borderRadius: 24,
    maxWidth: "100%",
    alignSelf: "center",
  },
  displayedHintContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 24,
    paddingVertical: theme.spacing.small,
    paddingHorizontal: theme.spacing.medium,
  },
  displayedHintIcon: {
    color: "#14232A",
    fontSize: theme.responsive.responsiveFontSize(18),
    marginRight: theme.spacing.small,
  },
  hintText: {
    flexShrink: 1,
    color: "#14232A",
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(16),
    textAlign: "center",
  },
})

export default HintUI
