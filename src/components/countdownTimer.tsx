import React, { useState, useEffect, memo } from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { useGameStore } from "../state/gameStore"
import { countdownText } from "../utils/dateDisplay"

const CountdownTimer: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const styles = useStyles(themedStyles)

  const deadline = useGameStore(state => state.resetDeadline)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      <Typography style={compact ? styles.compactText : styles.text}>
        {countdownText(deadline)}
      </Typography>
    </View>
  )
}

interface CountdownStyles {
  compactContainer: ViewStyle
  compactText: TextStyle
  container: ViewStyle
  text: TextStyle
}

const themedStyles = (theme: Theme): CountdownStyles => ({
  compactContainer: { marginTop: 20 },
  compactText: { fontFamily: "PremiereSans", fontSize: 10, lineHeight: 16, letterSpacing: 1, textAlign: "center", color: theme.colors.textSecondary },
  container: {
    marginTop: theme.spacing.large,
    padding: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(8),
  },
  text: {
    ...theme.typography.caption,
    fontFamily: "PremiereSans",
    color: theme.colors.textSecondary,
    fontSize: theme.responsive.responsiveFontSize(14),
  },
})

export default memo(CountdownTimer)
