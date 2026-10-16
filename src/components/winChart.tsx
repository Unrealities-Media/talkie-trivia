import React, { memo } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { Typography } from "./ui/typography"
import { useStyles, Theme } from "../utils/hooks/useStyles"

export interface WinChartProps { wins: readonly number[]; difficultyLabel?: string }

/** Native layout and text keep the distribution usable without a chart SDK. */
const WinChart = memo(({ wins, difficultyLabel }: WinChartProps) => {
  const styles = useStyles(themedStyles)
  const valid = Array.isArray(wins) && wins.length <= 20
    && wins.every(count => Number.isSafeInteger(count) && count >= 0)
  const total = valid ? wins.reduce((sum, count) => sum + count, 0) : NaN
  if (!Number.isSafeInteger(total)) {
    return <Typography>Win distribution is unavailable for these saved statistics.</Typography>
  }
  if (total === 0) {
    return <View style={styles.container}><Typography style={styles.summary}>
      Your win distribution will appear here after your first win!
    </Typography></View>
  }

  // Older snapshots may omit trailing zero buckets. Preserve any historic ones.
  const counts = Array.from({ length: difficultyLabel ? wins.length : Math.max(5, wins.length) }, (_, index) => wins[index] ?? 0)
  const largest = Math.max(...counts)
  return (
    <View style={styles.container} testID="win-distribution">
      <Typography variant="h2" accessibilityRole="header">{difficultyLabel ? `${difficultyLabel} win distribution` : "Win distribution"}</Typography>
      <Typography style={styles.summary}>
        {total} {total === 1 ? "win" : "wins"} {difficultyLabel ? `on ${difficultyLabel}` : "across all difficulties"}. Wins by number of guesses:
      </Typography>
      {counts.map((count, index) => {
        const guesses = `${index + 1} ${index === 0 ? "guess" : "guesses"}`
        const label = `${guesses}: ${count} ${count === 1 ? "win" : "wins"}`
        return (
          <View key={index} style={styles.row} accessible accessibilityLabel={label}>
            <Typography>{label}</Typography>
            <View style={styles.track} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View testID={`win-bar-${index + 1}`} style={[styles.bar, { width: `${count / largest * 100}%` }]} />
            </View>
          </View>
        )
      })}
    </View>
  )
})

interface WinChartStyles { container: ViewStyle; summary: TextStyle; row: ViewStyle; track: ViewStyle; bar: ViewStyle }
const themedStyles = (theme: Theme): WinChartStyles => ({
  container: { width: "100%", paddingVertical: theme.spacing.medium, gap: theme.spacing.small },
  summary: { color: theme.colors.textPrimary },
  row: { width: "100%", gap: theme.spacing.extraSmall, paddingVertical: theme.spacing.extraSmall },
  track: { width: "100%", height: 12, borderRadius: 4, backgroundColor: theme.colors.surface, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4, backgroundColor: theme.colors.textPrimary },
})

export default WinChart
