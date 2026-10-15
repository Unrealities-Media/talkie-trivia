/** Legacy date-only keys remain readable in saved history. */
export function validChallengeKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:_LEVEL_[1-5])?$/.test(value)) return false
  const day = value.slice(0, 10)
  const time = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day
}
