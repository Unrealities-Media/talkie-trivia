import React, { useState } from "react"
import { View } from "react-native"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { useTheme } from "../contexts/themeContext"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"

// Deliberately local: practicing never reads today's answer or sends game actions.
function PracticeExample() {
  const [wrongGuess, setWrongGuess] = useState(false)
  const [won, setWon] = useState(false)
  return <View style={{ gap: 12 }}>
    <Typography accessibilityRole="header" variant="h2">Try a Medium example</Typography>
    <Typography>These movies are invented. Practice does not use daily guesses, hints or points.</Typography>
    <Typography>Plot clue: A baker boards a spaceship to deliver a cake.</Typography>
    {wrongGuess && <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <Typography>Moon Detective is incorrect. It shares the answer's decade: 1990s. A matching hint helps you narrow the answer; it does not mean the title is correct.</Typography>
      <Typography>More of the plot: Her floating cakes feed the crew.</Typography>
    </View>}
    {!won ? <>
      <Typography>{wrongGuess ? "4" : "5"} guesses left in this example. Tap a title to submit it.</Typography>
      <Button title="Moon Detective (1992)" variant="secondary" disabled={wrongGuess} onPress={() => setWrongGuess(true)} />
      <Button title="Space Bakery (1995)" variant="secondary" onPress={() => setWon(true)} />
    </> : <View accessibilityLiveRegion="polite">
      <Typography>Correct! Space Bakery is the answer. You used {wrongGuess ? "2 guesses" : "1 guess"}. Your daily game is unchanged.</Typography>
    </View>}
    {(wrongGuess || won) && <Button title="Restart example" variant="secondary" onPress={() => { setWrongGuess(false); setWon(false) }} />}
  </View>
}

export default function HowToPlay() {
  const [expanded, setExpanded] = useState(false)
  const [practice, setPractice] = useState(false)
  const { colors } = useTheme()
  const close = () => { setExpanded(false); setPractice(false) }
  return <View style={{ width: "100%", paddingVertical: 8, gap: 12 }}>
    <Button
      title={expanded ? "Hide instructions" : "How to play"}
      variant="secondary"
      accessibilityState={{ expanded }}
      onPress={() => expanded ? close() : setExpanded(true)}
    />
    {expanded && <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 16 }}>
      <Typography variant="h2" accessibilityRole="header">One movie each day</Typography>
      <Typography>Read the plot clue and find the movie. Search by title or title and year. Tapping a search result immediately submits a guess. Long-press a result to preview its title, year and poster first.</Typography>
      <Typography>An incorrect guess uses one attempt and reveals more of the plot while you still have guesses left. You cannot guess the same movie twice. Guess correctly to win. Running out of guesses or confirming Give Up ends today's game and reveals the answer.</Typography>
      <Button title={practice ? "Hide practice" : "Try a practice example"} variant="secondary" accessibilityState={{ expanded: practice }} onPress={() => setPractice(value => !value)} />
      {practice && <>
        <PracticeExample />
        <Button title="Back to daily game" onPress={close} />
      </>}
      <Typography variant="h2" accessibilityRole="header">Choose your challenge</Typography>
      <Typography>Today's difficulty is locked when the game opens. Change it in Profile for your next challenge. Plot clues reveal gradually in every difficulty.</Typography>
      {Object.entries(DIFFICULTY_MODES).map(([level, mode]) => <View key={level} style={{ gap: 4 }}>
        <Typography accessibilityRole="header">{mode.label}: {mode.guessesMax} guesses, up to {Math.round(mode.scoreMultiplier * 1000)} points</Typography>
        <Typography>{mode.description}</Typography>
      </View>)}
      <Typography>Medium matches can reveal the director, main genre, decade or cast. A shared category is a clue, not a correct answer. Easy hints are optional: three per game, with no points to earn or purchases to unlock them.</Typography>
      <Typography variant="h2" accessibilityRole="header">Scoring and the next movie</Typography>
      <Typography>Fewer guesses earn more points when you win. Each Easy hint subtracts 50 points from your winning score. Other modes have no hint penalty. A loss or Give Up scores zero. There is no speed bonus, so take your time.</Typography>
      <Typography>A new movie arrives worldwide at 00:00 UTC, which may be a different time where you live. The countdown shows when. Finishing early does not unlock another daily game.</Typography>
      <Typography variant="h2" accessibilityRole="header">Play as a guest</Typography>
      <Typography>You can play without signing in with Google. An internet connection is needed to load and save the daily game. Wait for each move to save; if it cannot save, use Retry save.</Typography>
      <Typography>Guest progress is saved to your guest account. Link an account in Profile if you want to keep access across devices. Losing the guest session, such as after reinstalling, can leave unlinked progress inaccessible. Daily reminders are optional in Profile.</Typography>
      <Button title="Close instructions" onPress={close} />
    </View>}
  </View>
}
