import { createHash } from "node:crypto"
import { HttpsError } from "firebase-functions/v2/https"

/** Only immutable, reviewed schedule snapshots may start a new challenge. */
export function publishedContent(value: any, challengeId: string, catalogVersion: string) {
  const content = value?.content
  let publishedTime = NaN
  try {
    const date = typeof value?.date?.toDate === "function" ? value.date.toDate() : value?.date
    publishedTime = Date.prototype.getTime.call(date)
  } catch { /* Invalid/missing timestamp fails the content gate. */ }
  const valid = value?.schemaVersion === 1 && value?.catalogVersion === catalogVersion &&
    Number.isSafeInteger(value?.movieId) && value.movieId > 0 &&
    Number.isFinite(publishedTime) && new Date(publishedTime).toISOString() === `${challengeId}T00:00:00.000Z` &&
    typeof value.reviewedBy === "string" && value.reviewedBy.trim().length > 0 &&
    typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt)) && Date.parse(value.reviewedAt) <= Date.now() &&
    typeof content?.description === "string" && Array.from(content.description.trim()).length >= 100 && Array.from(content.description).length <= 2500 &&
    typeof content?.tagline === "string" && Array.from(content.tagline).length <= 500 &&
    typeof content?.imdbId === "string" && (content.imdbId === "" || /^tt\d{7,10}$/.test(content.imdbId))
  if (!valid) throw new HttpsError("unavailable", "Today's challenge is being prepared. Please try again soon.")
  const hash = createHash("sha256").update(`${value.movieId}\n${content.description}\n${content.imdbId}\n${content.tagline}`).digest("hex")
  if (value.contentHash !== hash) throw new HttpsError("unavailable", "Today's challenge is being prepared. Please try again soon.")
  return content as { description: string; imdbId: string; tagline: string }
}
