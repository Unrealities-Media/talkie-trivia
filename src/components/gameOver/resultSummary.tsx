import React from "react"
import { View } from "react-native"
import { PlayerGame } from "../../models/game"
import { DIFFICULTY_MODES } from "../../config/difficulty"
import { challengeDay, manualHintsUsed, savedScore } from "../../utils/resultSummary"
import { Typography } from "../ui/typography"

export default function ResultSummary({ game }: { game: PlayerGame }) {
  const score = savedScore(game)
  const hints = manualHintsUsed(game)
  const day = challengeDay(game)
  return <View style={{ width: "100%", gap: 8, paddingVertical: 16 }}>
    <Typography accessibilityRole="header" variant="h2">Your result</Typography>
    {day && <Typography>{day} (UTC day)</Typography>}
    <Typography>{DIFFICULTY_MODES[game.difficulty]?.label || "Unknown difficulty"} · {game.guesses.length}/{game.guessesMax} guesses used</Typography>
    <Typography>{score === null ? "Saved score unavailable" : `Saved score: ${score} points`}</Typography>
    <Typography>{game.correctAnswer
      ? "Your winning score depends on difficulty and guesses used. Fewer guesses earn more points; time taken does not affect it."
      : "A loss or Give Up scores zero. You can read the complete clue and movie details below."}</Typography>
    {game.difficulty === "LEVEL_2" && <Typography>
      {hints}/3 Easy hints used{game.correctAnswer ? `: ${hints * 50} points deducted from the winning score.` : ". Hints do not subtract extra points from a loss."}
    </Typography>}
  </View>
}
