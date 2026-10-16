import rewards from "../data/movieRewards.json"
import { TriviaItem } from "../models/trivia"

interface RewardMetadata { backdrop?: string; summary?: string; tagline?: string; portraits?: Record<string, string> }
const byId: Record<string, RewardMetadata> = rewards
const text = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined

/** Saved content wins; older snapshots can still show a complete movie synopsis. */
export function movieReward(movie: TriviaItem) {
  const reward = byId[String(movie.id)]
  const cast = movie.hints.find(hint => hint.type === "actors")?.value
  return {
    backdrop: text(movie.metadata.backdrop_path) || reward?.backdrop,
    summary: text(movie.metadata.fullSummary) || reward?.summary || movie.description,
    tagline: text(movie.metadata.tagline) || reward?.tagline,
    people: (Array.isArray(cast) ? cast : []).filter(person => person && typeof person.name === "string" && person.name.trim()).map(person => ({
      name: person.name as string,
      imdbId: person.imdb_id as unknown,
      // Match exact names within this movie; never substitute a different actor.
      portrait: text(person.profile_path) || reward?.portraits?.[person.name],
    })),
  }
}
