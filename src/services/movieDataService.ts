import { TriviaItem, BasicTriviaItem } from "../models/trivia"
import searchIndexData from "../data/searchIndex.json"

interface SearchIndexMovie {
  i: number
  t: string
  y: string
  p: string
  d: string
  c: string[]
  g: string[]
  a?: string[]
}

/** Local search/feedback metadata only. Daily content comes from startGame. */
export class MovieDataService {
  private searchIndex: readonly SearchIndexMovie[] = searchIndexData as SearchIndexMovie[]

  public getCatalogLists(): { basicItems: BasicTriviaItem[]; fullItems: TriviaItem[] } {
    return {
      basicItems: this.searchIndex.map(movie => ({ id: movie.i, title: movie.t, releaseDate: movie.y, posterPath: movie.p, ...(movie.a?.length ? { aliases: movie.a } : {}) })),
      fullItems: this.searchIndex.map(movie => ({
        id: movie.i, title: movie.t, description: "", posterPath: movie.p,
        releaseDate: movie.y, metadata: {},
        hints: [
          { type: "director", label: "Director", value: movie.d || "N/A" },
          { type: "genre", label: "Genre", value: movie.g?.[0] || "N/A" },
          { type: "decade", label: "Decade", value: movie.y ? `${movie.y.substring(0, 3)}0s` : "N/A" },
          { type: "actors", label: "Actors", value: (movie.c || []).map(name => ({ name })) },
        ],
      })),
    }
  }
}
