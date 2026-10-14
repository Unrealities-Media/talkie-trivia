import React from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { useStyles, Theme } from "../../utils/hooks/useStyles"
import { Typography } from "../ui/typography"

interface FullPlotSectionProps {
  overview: string
}

const FullPlotSection: React.FC<FullPlotSectionProps> = ({ overview }) => {
  const styles = useStyles(themedStyles)

  return (
    <View style={styles.container}>
      <Typography accessibilityRole="header" variant="body" style={styles.title}>
        The complete clue
      </Typography>
      <Typography variant="body" style={styles.text}>
        {overview}
      </Typography>
    </View>
  )
}

interface FullPlotStyles {
  container: ViewStyle
  title: TextStyle
  text: TextStyle
}

const themedStyles = (theme: Theme): FullPlotStyles => ({
  container: {
    width: "100%",
    marginTop: theme.spacing.extraLarge,
    padding: theme.spacing.medium,
    backgroundColor: theme.colors.background,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontFamily: "PremiereDisplay",
    fontSize: 24,
    lineHeight: 30,
    color: theme.colors.textPrimary,
    textAlign: "left",
    marginBottom: theme.spacing.small,
  },
  text: {
    color: theme.colors.textPrimary,
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(14),
    lineHeight: theme.responsive.responsiveFontSize(20),
  },
})

export default FullPlotSection
