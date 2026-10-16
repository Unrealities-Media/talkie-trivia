import { movieReward } from "../../src/services/movieRewardService"
import { defaultTriviaItem } from "../../src/models/default"

it("enriches old snapshots by movie ID and exact cast name without changing the clue", () => {
  const movie = { ...defaultTriviaItem, id: 27205, description: "A short hard-mode clue.", hints: [{ type: "actors", label: "Actors", value: [{ name: "Leonardo DiCaprio" }, { name: "Unrelated person" }, null] }] }
  const result = movieReward(movie)
  expect(result.summary).not.toBe(movie.description)
  expect(result.backdrop).toMatch(/^\/.+\.jpg$/)
  expect(result.people[0].portrait).toMatch(/^\/.+\.jpg$/)
  expect(result.people[1].portrait).toBeUndefined()
  expect(result.people).toHaveLength(2)
  expect(movie.description).toBe("A short hard-mode clue.")
})
it("prefers published snapshot content and honors saved portrait and IMDb references", () => {
  const result = movieReward({ ...defaultTriviaItem, id: 27205, metadata: { fullSummary: "Published story", tagline: "Published tagline", backdrop_path: "/saved.jpg" }, hints: [{ type: "actors", label: "Actors", value: [{ name: "Leonardo DiCaprio", profile_path: "/saved-person.jpg", imdb_id: "nm0000138" }] }] })
  expect(result).toMatchObject({ summary: "Published story", tagline: "Published tagline", backdrop: "/saved.jpg", people: [{ portrait: "/saved-person.jpg", imdbId: "nm0000138" }] })
})
it("supports missing enrichment, missing cast and malformed cast entries", () => {
  expect(movieReward({ ...defaultTriviaItem, description: "Existing story", hints: [{ type: "actors", label: "Actors", value: [null, {}, { name: "" }] }] })).toMatchObject({ summary: "Existing story", people: [] })
})
