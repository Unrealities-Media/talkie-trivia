import React, { useState, useEffect, memo } from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Typography } from "./ui/typography"
import { useGameStore } from "../state/gameStore"
import { countdownText } from "../utils/dateDisplay"

const CountdownTimer: React.FC = () => {
  const styles = useStyles(themedStyles)

  const deadline = useGameStore(state => state.resetDeadline)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick(value => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <View style={styles.container}>
      <Typography style={styles.text}>
        {countdownText(deadline)}
      </Typography>
    </View>
  )
}

interface CountdownStyles {
  container: ViewStyle
  text: TextStyle
}

const themedStyles = (theme: Theme): CountdownStyles => ({
  container: {
    marginTop: theme.spacing.large,
    padding: theme.spacing.small,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(8),
  },
  text: {
    ...theme.typography.caption,
    fontFamily: "Arvo-Bold",
    color: theme.colors.textSecondary,
    fontSize: theme.responsive.responsiveFontSize(14),
  },
})

export default memo(CountdownTimer)
