import { Searcher } from "fast-fuzzy"
import { BasicTriviaItem } from "../models/trivia"

// Keep letters/numbers from every script; punctuation is a word boundary except
// apostrophes, which should not make “Schindler's” different from “Schindlers”.
export const normalizeMovieQuery = (value: string): string => value
  .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/['’‘ʼ]/g, "").replace(/&/g, " and ")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")

/** Build once per catalog, not once per keystroke. IDs remain canonical. */
export function createMovieSearch(items: readonly BasicTriviaItem[]) {
  const entries = items.map(item => ({
    item,
    year: item.releaseDate?.slice(0, 4) || "",
    names: [...new Set([item.title, ...(item.aliases || [])].map(normalizeMovieQuery).filter(Boolean))],
  }))
  const exact = new Map<string, typeof entries>()
  for (const entry of entries) for (const name of entry.names) {
    exact.set(name, [...(exact.get(name) || []), entry])
  }
  const fuzzy = new Searcher(entries, { keySelector: entry => entry.names, threshold: 0.8 })

  return (input: string): BasicTriviaItem[] => {
    const normalized = normalizeMovieQuery(input)
    if (!normalized) return []
    // Treat a trailing year as a filter, but preserve numeric titles like “1917”.
    const yearMatch = normalized.match(/^(.+) ((?:18|19|20|21)\d{2})$/)
    const title = yearMatch?.[1] || normalized
    const year = yearMatch?.[2]
    const matches = (exact.get(normalized) || []).concat(
      (exact.get(title) || []).filter(entry => !year || entry.year === year)
    )
    const candidates = year ? entries.filter(entry => entry.year === year) : entries
    // One character is useful for exact titles, not thousands of fuzzy matches.
    if (matches.length === 0 && [...title].length > 1) {
      matches.push(...candidates.filter(entry => entry.names.some(name => name.startsWith(title))))
      matches.push(...fuzzy.search(title).filter(entry => !year || entry.year === year))
    }
    const seen = new Set<string>()
    return matches.filter(entry => {
      const id = String(entry.item.id)
      if (seen.has(id)) return false
      seen.add(id)
      return true
    }).map(entry => entry.item)
  }
}
