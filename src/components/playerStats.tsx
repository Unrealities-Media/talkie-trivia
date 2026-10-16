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
          <StatItem label="Challenges completed" value={playerStats.games} />
          <StatItem label="Movies solved" value={playerStats.wins.reduce((sum, value) => sum + value, 0)} />
          <StatItem label="Days completed" value={playerStats.daysCompleted ?? 0} />
          <StatItem label="All five completed" value={playerStats.allFiveCompleted ?? playerStats.allFiveDays?.length ?? 0} />
          <StatItem label="All five solved" value={playerStats.allFiveSolved ?? 0} />
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
          return <View key={level}>
            <Typography variant="h2">{DIFFICULTY_MODES[level].label}</Typography>
            <Typography>{stats?.wins ?? 0} solved / {stats?.games ?? 0} completed · {stats?.games ? Math.round(stats.wins / stats.games * 100) + "% win rate" : "No completed challenges"} · {stats?.score ?? 0} points</Typography>
            {!!stats?.guesses && <WinChart wins={stats.guesses} difficultyLabel={DIFFICULTY_MODES[level].label} />}
          </View>
        })}
        <Typography>Points accumulate from solved challenges and depend on difficulty; they are not a skill rating. All five completed includes losses and reveals.</Typography>
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
