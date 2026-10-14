import { MovieDataService } from "../../src/services/movieDataService"
import { createMovieSearch } from "../../src/utils/movieSearch"
jest.mock("../../src/data/searchIndex.json", () => [
  { i: 101, t: "Movie A", y: "1999", p: "/a.jpg", d: "Director A", g: ["Drama"], c: ["Actor A", "Actor B"], a: ["Alternate Movie"] },
])
it("provides local search metadata and named cast without fabricated shared person IDs", () => {
  const { basicItems, fullItems } = new MovieDataService().getCatalogLists()
  expect(basicItems).toEqual([{ id: 101, title: "Movie A", releaseDate: "1999", posterPath: "/a.jpg", aliases: ["Alternate Movie"] }])
  expect(createMovieSearch(basicItems)("Alternate Movie 1999")).toEqual(basicItems)
  expect(fullItems[0].hints.find(hint => hint.type === "actors")?.value).toEqual([{ name: "Actor A" }, { name: "Actor B" }])
  expect(fullItems[0].description).toBe("")
})
