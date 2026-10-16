import PlayerStats from "../../../models/playerStats"
import { QueryDocumentSnapshot, SnapshotOptions } from "firebase/firestore"

export const playerStatsConverter = {
  toFirestore: (playerStats: PlayerStats) => {
    let ps = {
      id: playerStats.id,
      statisticsVersion: playerStats.statisticsVersion ?? null,
      daysCompleted: playerStats.daysCompleted ?? 0,
      allFiveCompleted: playerStats.allFiveCompleted ?? 0,
      allFiveSolved: playerStats.allFiveSolved ?? 0,
      byDifficulty: playerStats.byDifficulty ?? {},
      lastCompletedDate: playerStats.lastCompletedDate ?? null,
      currentStreak: playerStats.currentStreak,
      games: playerStats.games,
      maxStreak: playerStats.maxStreak,
      wins: playerStats.wins,
      hintsAvailable: playerStats.hintsAvailable,
      hintsUsedCount: playerStats.hintsUsedCount,
      lastStreakMessageDate: playerStats.lastStreakMessageDate ?? null,
      allTimeScore: playerStats.allTimeScore || 0,
    }
    return ps
  },
  fromFirestore: (
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): PlayerStats => {
    const data = snapshot.data(options)
    let ps: PlayerStats = {
      id: data.id,
      statisticsVersion: data.statisticsVersion,
      daysCompleted: data.daysCompleted ?? 0,
      allFiveCompleted: data.allFiveCompleted ?? data.allFiveDays?.length ?? 0,
      allFiveSolved: data.allFiveSolved ?? 0,
      byDifficulty: data.byDifficulty ?? {},
      lastCompletedDate: data.lastCompletedDate ?? null,
      currentStreak: data.currentStreak,
      games: data.games,
      maxStreak: data.maxStreak,
      wins: data.wins,
      hintsAvailable: data.hintsAvailable ?? 3,
      hintsUsedCount: data.hintsUsedCount || 0,
      lastStreakMessageDate: data.lastStreakMessageDate ?? undefined,
      allTimeScore: data.allTimeScore || 0,
    }
    return ps
  },
}
