import { createMovieSearch } from "../../src/utils/movieSearch"
import { MovieDataService } from "../../src/services/movieDataService"

const movie = (id: number, title: string, releaseDate = "2000", aliases: string[] = []) => ({ id, title, releaseDate, aliases, posterPath: "" })
const items = [movie(1, "9"), movie(2, "X"), movie(3, "Z"), movie(4, "It", "1990"), movie(5, "It", "2017"),
  movie(6, "Amélie", "2001", ["Le Fabuleux Destin d’Amélie Poulain"]), movie(7, "Schindler’s List"),
  movie(8, "WALL·E"), movie(9, "1917", "2019"), movie(10, "Inception"), movie(11, "Inception: The Cobol Job")]
const find = createMovieSearch(items)
const ids = (query: string) => find(query).map(item => item.id)

it("finds only exact single-character titles, ignoring case and surrounding whitespace", () => {
  expect(ids(" 9 ")).toEqual([1]); expect(ids("x")).toEqual([2]); expect(ids("Z")).toEqual([3])
  expect(ids("i")).toEqual([]); expect(ids(" ")).toEqual([]); expect(ids("...")).toEqual([])
})
it("disambiguates remakes by year without losing numeric titles", () => {
  expect(ids("It")).toEqual([4, 5]); expect(ids("It (2017)")).toEqual([5])
  expect(ids("It 1980")).toEqual([]); expect(ids("1917")).toEqual([9]); expect(ids("1917 2019")).toEqual([9])
})
it("supports normalized punctuation, accents, reviewed aliases and typing mistakes", () => {
  expect(ids("AMELIE")).toEqual([6]); expect(ids("Le Fabuleux Destin d'Amelie Poulain")).toEqual([6])
  expect(ids("Schindlers List")).toEqual([7]); expect(ids("wall-e")).toEqual([8])
  expect(ids("Inceptoin")).toContain(10)
})
it("ranks exact titles first and returns each canonical ID once", () => {
  expect(ids("Inception")).toEqual([10])
  expect(ids("Incep")).toEqual([10, 11])
})
it("makes every released catalog title selectable by full title and title/year", () => {
  const catalog = new MovieDataService().getCatalogLists().basicItems
  const searchCatalog = createMovieSearch(catalog)
  const missing = catalog.filter(item => !searchCatalog(item.title).some(result => result.id === item.id)
    || !searchCatalog(`${item.title} (${item.releaseDate.slice(0, 4)})`).some(result => result.id === item.id))
  expect(catalog.length).toBeGreaterThan(1000)
  expect(missing.map(item => `${item.id}: ${item.title} (${item.releaseDate})`)).toEqual([])
})
