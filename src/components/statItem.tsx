import React from "react"
import { View, StyleProp, TextStyle, ViewStyle } from "react-native"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { u } from "../styles/utils"

interface StatItemProps {
  label: string
  value: string | number
  valueStyle?: StyleProp<TextStyle>
}

const StatItem: React.FC<StatItemProps> = ({ label, value, valueStyle }) => {
  const styles = useStyles(themedStyles)

  return (
    <View
      style={
        [
          u.flexRow,
          u.justifyBetween,
          u.alignCenter,
          styles.container,
        ] as ViewStyle[]
      }
    >
      <Typography style={styles.label}>{label}</Typography>
      <Typography style={[styles.value, valueStyle]}>{value}</Typography>
    </View>
  )
}

interface StatItemStyles {
  container: ViewStyle
  label: TextStyle
  value: TextStyle
}

const themedStyles = (theme: Theme): StatItemStyles => ({
  container: {
    paddingVertical: theme.spacing.extraSmall,
    width: "100%",
  },
  label: {
    ...theme.typography.bodyText,
    fontFamily: "PremiereSans",
    color: theme.colors.textSecondary,
    fontSize: theme.responsive.responsiveFontSize(16),
  },
  value: {
    ...theme.typography.bodyText,
    fontFamily: "PremiereSans",
    color: theme.colors.quinary,
    fontSize: theme.responsive.responsiveFontSize(16),
  },
})

export default StatItem
