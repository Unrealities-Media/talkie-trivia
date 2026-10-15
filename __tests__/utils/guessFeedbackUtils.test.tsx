import { generateImplicitHint } from "../../src/utils/guessFeedbackUtils"
import { TriviaItem } from "../../src/models/trivia"

// Mock Data Helper
const createItem = (id: number, hints: any[]): TriviaItem => ({
  id,
  title: `Movie ${id}`,
  description: "Plot",
  posterPath: "/path.jpg",
  releaseDate: "2020-01-01",
  metadata: {},
  // Use provided label or fallback to type (lowercase)
  hints: hints.map((h) => ({
    type: h.type,
    label: h.label || h.type,
    value: h.value,
  })),
})

describe("Utils: guessFeedbackUtils", () => {
  describe("generateImplicitHint", () => {
    it("should return standard negative feedback if no matches found", () => {
      const correct = createItem(1, [{ type: "director", value: "Nolan" }])
      const guessed = createItem(2, [{ type: "director", value: "Spielberg" }])

      const result = generateImplicitHint(guessed, correct, {})

      expect(result.feedback).toBe("Not quite! Try again.")
      expect(result.revealedHints).toEqual({})
      expect(result.hintInfo).toBeNull()
    })

    it("should identify a match for simple string values (e.g. Director)", () => {
      // We explicitly provide the Label "Director" to match real app data structure
      const correct = createItem(1, [
        { type: "director", label: "Director", value: "Nolan" },
      ])
      const guessed = createItem(2, [
        { type: "director", label: "Director", value: "Nolan" },
      ])

      const result = generateImplicitHint(guessed, correct, {})

      // Updated expectation to match the actual output format
      expect(result.feedback).toContain(
        "You're on the right track with the Director!"
      )
      expect(result.feedback).not.toContain("(Hint Revealed)")
      expect(result.revealedHints).toEqual({ director: true })
      expect(result.hintInfo).toHaveLength(1)
      expect(result.hintInfo![0].value).toBe("Nolan")
    })

    it("should identify a match for array values (e.g. Actors)", () => {
      const actorA = { id: 10, name: "Tom Hanks" }
      const actorB = { id: 11, name: "Tim Allen" }
      const actorC = { id: 12, name: "Carrie Fisher" }

      const correct = createItem(1, [
        { type: "actors", label: "Actors", value: [actorA, actorB] },
      ])
      const guessed = createItem(2, [
        { type: "actors", label: "Actors", value: [actorA, actorC] },
      ]) // Match on ActorA

      const result = generateImplicitHint(guessed, correct, {})

      expect(result.feedback).toContain(
        "You're on the right track with the Actors!"
      )
      expect(result.feedback).not.toContain("(Hint Revealed)")
      expect(result.revealedHints).toEqual({ actors: true })
    })

    it("should return 'getting warmer' if hint was already revealed previously", () => {
      const correct = createItem(1, [{ type: "director", value: "Nolan" }])
      const guessed = createItem(2, [{ type: "director", value: "Nolan" }])

      // Pass in 'director: true' as already used
      const result = generateImplicitHint(guessed, correct, { director: true })

      expect(result.feedback).toBe("You're getting warmer! Keep guessing.")
      // Should not add new revealed hints since it was already known
      expect(result.revealedHints).toEqual({})
      // But hintInfo should still be returned for display
      expect(result.hintInfo).not.toBeNull()
    })

    it("should handle error cases gracefully", () => {
      // @ts-ignore
      const result = generateImplicitHint(null, null)
      expect(result.feedback).toContain("unexpected error")
    })
  })
})
