import { createHash } from "node:crypto"
import { HttpsError } from "firebase-functions/v2/https"
import { DifficultyLevel } from "./utils/difficulty"

export const CLUE_LEVELS: DifficultyLevel[] = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4", "LEVEL_5"]
export function contentDigest(movieId: number, content: { description: string; imdbId: string; tagline: string; clues?: Record<DifficultyLevel, string> }) {
  const base = `${movieId}\n${content.description}\n${content.imdbId}\n${content.tagline}`
  return createHash("sha256").update(content.clues
    ? `clues-v2\n${base}\n${CLUE_LEVELS.map(level => content.clues![level]).join("\n")}` : base).digest("hex")
}

/** Only immutable, reviewed schedule snapshots may start a new challenge. */
export function publishedContent(value: any, challengeId: string, catalogVersion: string) {
  const content = value?.content
  let publishedTime = NaN
  try {
    const date = typeof value?.date?.toDate === "function" ? value.date.toDate() : value?.date
    publishedTime = Date.prototype.getTime.call(date)
  } catch { /* Invalid/missing timestamp fails the content gate. */ }
  const variantsValid = value?.schemaVersion === 1 ? content?.clues === undefined :
    value?.schemaVersion === 2 && content?.clues && Object.keys(content.clues).length === 5 &&
    CLUE_LEVELS.every(level => typeof content.clues[level] === "string" &&
      Array.from(content.clues[level].trim()).length >= 20 && Array.from(content.clues[level]).length <= 2500) &&
    content.clues.LEVEL_1 === content.description
  const valid = variantsValid && value?.catalogVersion === catalogVersion &&
    Number.isSafeInteger(value?.movieId) && value.movieId > 0 &&
    Number.isFinite(publishedTime) && new Date(publishedTime).toISOString() === `${challengeId}T00:00:00.000Z` &&
    typeof value.reviewedBy === "string" && value.reviewedBy.trim().length > 0 &&
    typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt)) && Date.parse(value.reviewedAt) <= Date.now() &&
    typeof content?.description === "string" && Array.from(content.description.trim()).length >= 100 && Array.from(content.description).length <= 2500 &&
    typeof content?.tagline === "string" && Array.from(content.tagline).length <= 500 &&
    typeof content?.imdbId === "string" && (content.imdbId === "" || /^tt\d{7,10}$/.test(content.imdbId))
  if (!valid) throw new HttpsError("unavailable", "Today's challenge is being prepared. Please try again soon.")
  const hash = contentDigest(value.movieId, content)
  if (value.contentHash !== hash) throw new HttpsError("unavailable", "Today's challenge is being prepared. Please try again soon.")
  return content as { description: string; imdbId: string; tagline: string; clues?: Record<DifficultyLevel, string> }
}
