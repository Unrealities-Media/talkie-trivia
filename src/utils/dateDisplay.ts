// A release year is calendar metadata, not a local-time instant.
export function releaseYear(value: string | undefined | null): string {
  return value?.match(/^(\d{4})(?:$|-)/)?.[1] || ""
}

export function countdownText(deadline: number | null, now = performance.now()): string {
  if (deadline === null || !Number.isFinite(deadline)) return "Daily reset: 00:00 UTC"
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  if (!seconds) return "Checking the next daily challenge…"
  const pad = (value: number) => String(value).padStart(2, "0")
  return `Next game in ${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)} · 00:00 UTC`
}
