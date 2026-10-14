import React, { memo } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { Typography } from "./ui/typography"
import { useStyles, Theme } from "../utils/hooks/useStyles"

interface TitleHeaderProps {
  title: string
}

const TitleHeader: React.FC<TitleHeaderProps> = memo(({ title }) => {
  const styles = useStyles(themedStyles)

  return (
    <View style={styles.container}>
      <Typography variant="h2" accessibilityRole="header" style={styles.header}>
        {title}
      </Typography>
    </View>
  )
})

interface TitleHeaderStyles {
  container: ViewStyle
  header: TextStyle
}

const themedStyles = (theme: Theme): TitleHeaderStyles => ({
  container: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingVertical: theme.responsive.scale(4),
  },
  header: {
    fontSize: theme.responsive.responsiveFontSize(18),
    color: theme.colors.accentText,
    textAlign: "left",
  },
})

export default TitleHeader
