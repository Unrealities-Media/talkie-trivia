import React from "react"
import { View, Text, ViewStyle, TextStyle } from "react-native"
import Animated from "react-native-reanimated"
import { useSkeletonAnimation } from "../../utils/hooks/useSkeletonAnimation"
import { useStyles, Theme } from "../../utils/hooks/useStyles"

export const SkeletonRow = ({ index }: { index: number }) => {
  const styles = useStyles(themedStyles)
  const animatedStyle = useSkeletonAnimation()

  return (
    <Animated.View style={[styles.skeletonRow, animatedStyle]}>
      <Text style={styles.guessNumber}>{index + 1}</Text>
      <View style={styles.skeletonTextContainer}>
        <View style={styles.skeletonText} />
      </View>
    </Animated.View>
  )
}

interface SkeletonRowStyles {
  skeletonRow: ViewStyle
  guessNumber: TextStyle
  skeletonTextContainer: ViewStyle
  skeletonText: ViewStyle
}

const themedStyles = (theme: Theme): SkeletonRowStyles => ({
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.responsive.scale(8),
    paddingHorizontal: theme.spacing.medium,
    minHeight: theme.responsive.scale(44),
    marginBottom: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.small,
  },
  guessNumber: {
    color: theme.colors.textSecondary,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
    marginRight: theme.spacing.small,
  },
  skeletonTextContainer: {
    backgroundColor: theme.colors.border,
    flex: 1,
    borderRadius: theme.responsive.scale(4),
    overflow: "hidden",
  },
  skeletonText: {
    height: theme.responsive.scale(16),
    width: "100%",
  },
})
