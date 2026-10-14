import React, { memo } from "react"
import { View, TextStyle, ViewStyle } from "react-native"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import WinChart from "./winChart"
import StatItem from "./statItem"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { u } from "../styles/utils"
import { Typography } from "./ui/typography"

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
          <StatItem
            label="Hints Available"
            value={playerStats.hintsAvailable}
          />
        </View>
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
