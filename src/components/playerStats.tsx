import React, { memo } from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import WinChart from "./winChart"
import StatItem from "./statItem"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { u } from "../styles/utils"
import { Typography } from "./ui/typography"
import { DIFFICULTY_MODES, DifficultyLevel } from "../config/difficulty"

export interface PlayerStatsContainerProps {
  player: Player | null
  playerStats: PlayerStats | null
}

const PlayerStatsContainer = memo(
  ({ player, playerStats }: PlayerStatsContainerProps) => {
    const styles = useStyles(themedStyles)

    if (!player || !playerStats) {
      return (
        <View style={[styles.container, u.justifyCenter, u.alignCenter]}>
          <Typography>No statistics available.</Typography>
        </View>
      )
    }

    return (
      <View
        style={styles.container}
        key={player.id}
        testID="player-stats-container" 
      >
        <WinChart wins={playerStats.wins} />
        <View style={styles.statsContainer}>
          <StatItem
            label="All-Time Score"
            value={playerStats.allTimeScore.toLocaleString()}
            valueStyle={styles.scoreText}
          />
          <StatItem label="Games Played" value={playerStats.games} />
          <StatItem label="All Five Days" value={playerStats.allFiveDays?.length ?? 0} />
          <StatItem
            label="Current Streak"
            value={playerStats.currentStreak}
            valueStyle={styles.streakText}
          />
          <StatItem
            label="Max Streak"
            value={playerStats.maxStreak}
            valueStyle={styles.streakText}
          />
        </View>
        <Typography variant="h2">By difficulty</Typography>
        {(Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]).map(level => {
          const stats = playerStats.byDifficulty?.[level]
          return <Typography key={level}>{DIFFICULTY_MODES[level].label}: {stats?.wins ?? 0} wins / {stats?.games ?? 0} played · {stats?.score ?? 0} points</Typography>
        })}
        <Typography>Complete any challenge to keep your daily streak. Wins and losses both count.</Typography>
        <Typography variant="caption">Each Easy challenge includes three optional hints. Each hint costs 50 points from a winning score.</Typography>
      </View>
    )
  }
)

interface PlayerStatsStyles {
  container: ViewStyle
  statsContainer: ViewStyle
  scoreText: TextStyle
  streakText: TextStyle
}

const themedStyles = (theme: Theme): PlayerStatsStyles => ({
  container: {
    flex: 1,
    padding: theme.spacing.small,
    width: "100%",
  },
  statsContainer: {
    paddingTop: theme.spacing.medium,
    width: "100%",
  },
  scoreText: {
    color: theme.colors.accentText,
  },
  streakText: {
    color: theme.colors.accentText,
  },
})

export default PlayerStatsContainer
