import React from "react"
import { View, Text, ViewStyle, TextStyle } from "react-native"
import { useStyles, Theme } from "../../utils/hooks/useStyles"

interface EmptyGuessTileProps {
  index: number
  testID?: string
}

export const EmptyGuessTile = ({ index, testID }: EmptyGuessTileProps) => {
  const styles = useStyles(themedStyles)
  return (
    <View style={styles.emptyGuessTile} testID={testID}>
      <Text style={styles.guessNumber}>{index + 1}</Text>
    </View>
  )
}

interface EmptyGuessTileStyles {
  emptyGuessTile: ViewStyle
  guessNumber: TextStyle
}

const themedStyles = (theme: Theme): EmptyGuessTileStyles => ({
  emptyGuessTile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.responsive.scale(8),
    paddingHorizontal: 4,
    minHeight: theme.responsive.scale(44),
    marginBottom: theme.spacing.small,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  guessNumber: {
    color: theme.colors.textSecondary,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
  },
})
