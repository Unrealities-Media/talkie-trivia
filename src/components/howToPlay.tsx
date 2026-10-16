import React, { useState } from "react"
import { View } from "react-native"
import { useTheme } from "../contexts/themeContext"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"

export default function HowToPlay({ summary }: { summary?: React.ReactNode } = {}) {
  const [expanded, setExpanded] = useState(false)
  const { colors } = useTheme()
  return <View style={{ width: "100%", gap: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      {summary && <View style={{ flex: 1 }}>{summary}</View>}
      <Button title={expanded ? "Close help" : "How to play"} variant="secondary" size="sm"
        style={{ borderWidth: 0, minHeight: 44, paddingHorizontal: 4, flexShrink: 0 }}
        accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} />
    </View>
    {expanded && <View style={{ backgroundColor: colors.surface, borderRadius: 6, padding: 16, gap: 12 }}>
      <Typography accessibilityRole="header" variant="h2">Guess the movie</Typography>
      <Typography>Search for a title, then select it to guess. Preview shows the poster and year without using a guess. A miss reveals more of the clue.</Typography>
      <Typography>Five different movies daily. Switch modes anytime; each keeps its own progress.</Typography>
      <Typography>Very Easy: all hints shown. Easy: three optional hints, −50 points each. Medium: matching guesses reveal hints. Hard: no hints. Very Hard: a shorter clue, no hints, three guesses.</Typography>
      <Typography>Other modes allow five guesses. Fewer guesses earn more points; Give Up reveals the answer and scores zero. Very Hard shows its whole clue immediately.</Typography>
      <Typography>New movies at 00:00 UTC. Finish any challenge to keep your streak.</Typography>
    </View>}
  </View>
}
