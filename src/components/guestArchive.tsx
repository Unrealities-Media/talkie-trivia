import React, { useEffect, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { GuestArchiveCursor, GuestArchiveEntry, guestArchiveService, ARCHIVE_PAGE_SIZE } from "../services/guestArchiveService"
import { MovieDataService } from "../services/movieDataService"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { Typography } from "./ui/typography"
import { Button } from "./ui/button"
import DetailModal from "./detailModal"
import { PlayerGame } from "../models/game"

const outcome = (game: PlayerGame) => game.correctAnswer ? "Won" : game.gaveUp ? "Gave up" : game.statsProcessed ? "Out of guesses" : "Unfinished"
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
function hintValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(hintValue).filter(Boolean).join(", ")
  if (value && typeof value === "object" && "name" in value) return hintValue(value.name)
  return typeof value === "string" || typeof value === "number" ? String(value) : ""
}
function PreservedDetails({ entry }: { entry: GuestArchiveEntry }) {
  const { game } = entry
  const catalog = useMemo(() => new Map(new MovieDataService().getCatalogLists().basicItems.map(item => [String(item.id), item])), [])
  const automaticHints = DIFFICULTY_MODES[game.difficulty].hintStrategy === "HINTS_ONLY_REVEALED"
  const usedHints = game.triviaItem.hints.filter(hint => automaticHints || game.hintsUsed?.[hint.type])
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Typography variant="h2" accessibilityRole="header">Preserved guest game</Typography>
    <Typography>{dateLabel(game.challengeId!)} · {DIFFICULTY_MODES[game.difficulty].label} · {outcome(game)}</Typography>
    <Typography>This is a saved copy. It cannot be continued or replace your account's game. Its score does not add to your statistics or streak.</Typography>
    <Typography variant="h2" accessibilityRole="header">{game.triviaItem.title}</Typography>
    <Typography>{game.triviaItem.description}</Typography>
    <Typography>Original score: {game.score ?? 0}. Guesses: {game.guesses.length}/{game.guessesMax}.</Typography>
    <Typography variant="h2" accessibilityRole="header">Guest guesses</Typography>
    {game.guesses.length === 0 && <Typography>No guesses were made.</Typography>}
    {game.guesses.map((guess, index) => {
      const item = catalog.get(String(guess.itemId))
      return <View key={`${index}-${guess.itemId}`} style={{ gap: 4 }}>
        <Typography>{index + 1}. {item ? `${item.title} (${item.releaseDate.slice(0, 4)})` : `Title no longer in the catalog (movie ${guess.itemId})`}{String(guess.itemId) === String(game.triviaItem.id) ? " — Correct" : " — Incorrect"}</Typography>
        {guess.hintInfo?.map((hint, hintIndex) => <Typography key={`${hint.type}-${hintIndex}`}>{hint.label}: {hintValue(hint.value) || "Not available"}</Typography>)}
      </View>
    })}
    <Typography variant="h2" accessibilityRole="header">Revealed hints</Typography>
    {automaticHints && <Typography>These clues were available automatically in this mode.</Typography>}
    {usedHints.length ? usedHints.map(hint => <Typography key={hint.type}>{hint.label}: {hintValue(hint.value) || "Not available"}</Typography>) : <Typography>No hints were revealed.</Typography>}
  </ScrollView>
}
function ArchiveForAccount({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<GuestArchiveEntry[]>([])
  const [page, setPage] = useState(0)
  const [cursors, setCursors] = useState<(GuestArchiveCursor | null)[]>([null])
  const [next, setNext] = useState<GuestArchiveCursor | null>(null)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<GuestArchiveEntry | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError(false); setSelected(null); setEntries([]); setNext(null)
    void guestArchiveService.page(uid, cursors[page]).then(result => {
      if (active) { setEntries(result.entries); setNext(result.next) }
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [uid, page, cursors, retry])
  return <View style={{ gap: 12 }}>
    <Typography>These guest games share a day with a game already in your saved account. They were kept separately and do not add points or streak credit. Opening a record reveals its movie answer.</Typography>
    {loading && <Typography accessibilityLiveRegion="polite">Loading preserved games…</Typography>}
    {error && <>
      <Typography variant="error" accessibilityRole="alert">We couldn't load these guest games. Check your connection and retry. Your records have not been removed.</Typography>
      <Button title="Retry preserved games" onPress={() => setRetry(value => value + 1)} />
    </>}
    {!loading && !error && entries.length === 0 && <Typography>No preserved guest games on this page.</Typography>}
    {entries.map((entry, index) => <View key={entry.id} style={{ gap: 4 }}>
      <Typography>{dateLabel(entry.game.challengeId!)} (UTC day) · {DIFFICULTY_MODES[entry.game.difficulty].label}</Typography>
      <Typography>{outcome(entry.game)} · {entry.game.guesses.length}/{entry.game.guessesMax} guesses</Typography>
      <Button title={`View guest record ${page * ARCHIVE_PAGE_SIZE + index + 1}`} variant="secondary" onPress={() => setSelected(entry)} accessibilityHint="Shows the original movie answer, guesses and revealed hints. Does not change your current game." />
    </View>)}
    {page > 0 && <Button title="Previous guest games" variant="secondary" disabled={loading} onPress={() => setPage(page - 1)} />}
    {next && <Button title="More guest games" variant="secondary" disabled={loading} onPress={() => {
      setCursors(previous => [...previous.slice(0, page + 1), next]); setPage(page + 1)
    }} />}
    <DetailModal show={selected !== null} toggleModal={() => setSelected(null)}>
      {selected && <PreservedDetails entry={selected} />}
    </DetailModal>
  </View>
}
/** Keying by owner immediately removes old rows/details on an account change. */
export default function GuestArchive({ uid }: { uid: string }) { return <ArchiveForAccount key={uid} uid={uid} /> }
