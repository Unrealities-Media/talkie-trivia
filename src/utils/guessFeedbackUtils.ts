import { TriviaItem, Hint } from "../models/trivia"

interface ImplicitHintResult {
  feedback: string | null
  revealedHints: Partial<Record<string, boolean>>
  hintInfo: Hint[] | null
}

const getHintValue = (type: string, item: TriviaItem): any => {
  return item.hints.find((h) => h.type === type)?.value
}

export function generateImplicitHint(
  guessedItem: TriviaItem,
  correctItem: TriviaItem,
  usedHints: Partial<Record<string, boolean>> = {}
): ImplicitHintResult {
  const result: ImplicitHintResult = {
    feedback: null,
    revealedHints: {},
    hintInfo: [],
  }

  if (!guessedItem || !correctItem) {
    return {
      feedback: "An unexpected error occurred with the trivia data.",
      revealedHints: {},
      hintInfo: null,
    }
  }

  const hintsFound: Hint[] = []
  let newHintRevealed = false
  let firstNewMatchMessage: string | null = null

  for (const correctHint of correctItem.hints) {
    const guessedHintValue = getHintValue(correctHint.type, guessedItem)
    if (guessedHintValue === null || guessedHintValue === undefined) continue

    let isMatch = false

    if (Array.isArray(correctHint.value)) {
      const identity = (item: any): string | null => {
        if (Number.isSafeInteger(item?.id) && item.id > 0) return `id:${item.id}`
        const name = typeof item?.name === "string" ? item.name.normalize("NFKC").trim().toLocaleLowerCase("en-US") : ""
        return name && !["n/a", "unknown"].includes(name) ? `name:${name}` : null
      }
      const correctIds = new Set(
        correctHint.value.map(identity).filter(Boolean)
      )
      const guessedIds = new Set(
        (Array.isArray(guessedHintValue) ? guessedHintValue : []).map(identity).filter(Boolean)
      )
      if (correctIds.size > 0 && guessedIds.size > 0) {
        for (const id of correctIds) {
          if (guessedIds.has(id)) {
            isMatch = true
            break
          }
        }
      }
    } else if (typeof correctHint.value === "object" && correctHint.value?.id) {
      isMatch = guessedHintValue?.id === correctHint.value.id
    } else {
      isMatch = !!correctHint.value && !["N/A", "Unknown"].includes(correctHint.value) && guessedHintValue === correctHint.value
    }

    if (isMatch) {
      const fullCorrectHint = correctItem.hints.find(
        (h) => h.type === correctHint.type
      )
      if (fullCorrectHint) {
        hintsFound.push(fullCorrectHint)
      }

      if (!usedHints[correctHint.type]) {
        result.revealedHints[correctHint.type] = true
        newHintRevealed = true
        if (!firstNewMatchMessage) {
          firstNewMatchMessage = `You're on the right track with the ${correctHint.label}! (Hint Revealed)`
        }
      }
    }
  }

  result.hintInfo = hintsFound.length > 0 ? hintsFound : null

  if (newHintRevealed) {
    result.feedback = firstNewMatchMessage
  } else if (hintsFound.length > 0) {
    result.feedback = "You're getting warmer! Keep guessing."
  } else {
    result.feedback = "Not quite! Try again."
  }

  return result
}
