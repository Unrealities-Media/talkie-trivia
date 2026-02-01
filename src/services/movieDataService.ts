import { IGameDataService } from "./iGameDataService"
import { GameMode, TriviaItem, BasicTriviaItem } from "../models/trivia"
import { db } from "./firebaseClient"
import { doc, getDoc } from "firebase/firestore"
import { FIRESTORE_COLLECTIONS } from "../config/constants"
import searchIndexData from "../data/searchIndex.json"

interface SearchIndexMovie {
  i: number // ID
  t: string // Title
  y: string // Year (e.g. "1999")
  p: string // Poster Path
  d: string // Director
  c: string[] // Cast (Array of names)
  g: string[] // Genres (Array of names)
}

interface FirestoreMovie {
  id?: number
  title?: string
  overview?: string
  manual_overview?: string
  poster_path?: string
  release_date?: string
  tagline?: string
  imdb_id?: string
  director?: string
}

export class MovieDataService implements IGameDataService {
  public mode: GameMode = "movies"

  // Cache the typed list for performance
  private searchIndex: readonly SearchIndexMovie[] =
    searchIndexData as SearchIndexMovie[]

  /**
   * Converts a minified local item into a format compatible with the UI components (Search Bar).
   */
  private _toBasicItem(m: SearchIndexMovie): BasicTriviaItem {
    return {
      id: m.i,
      title: m.t,
      releaseDate: m.y,
      posterPath: m.p,
    }
  }

  /**
   * Converts a minified local item into a "Full" item for the Game Engine (Implicit Feedback).
   * It reconstructs the 'hints' array so the game logic can check matches (Director, Actor, etc).
   */
  private _toLogicItem(m: SearchIndexMovie): TriviaItem {
    return {
      id: m.i,
      title: m.t,
      description: "", // Logic engine doesn't need plot
      posterPath: m.p,
      releaseDate: m.y,
      metadata: {},
      hints: [
        { type: "director", label: "Director", value: m.d || "N/A" },
        { type: "genre", label: "Genre", value: m.g?.[0] || "N/A" },
        {
          type: "decade",
          label: "Decade",
          value: m.y ? `${m.y.substring(0, 3)}0s` : "N/A",
        },
        // Map string array to object array expected by game logic
        {
          type: "actors",
          label: "Actors",
          value: (m.c || []).map((name) => ({ id: 0, name })),
        },
      ],
    }
  }

  /**
   * Transforms the rich Cloud Data into the displayable Daily Game object.
   */
  private _transformCloudMovie(movie: FirestoreMovie): TriviaItem {
    const id = movie.id ?? 0
    const title = movie.title || "Unknown Title"
    // Check manual override first
    const overview =
      movie.manual_overview || movie.overview || "No description available."
    const posterPath = movie.poster_path || ""
    const releaseDate = movie.release_date || ""
    const tagline = movie.tagline || null
    const directorName = movie.director || "N/A"

    return {
      id,
      title,
      description: overview,
      posterPath,
      releaseDate,
      metadata: {
        imdb_id: movie.imdb_id || null,
        tagline: tagline,
      },
      // Note: We reconstruct hints from Cloud data to ensure what the user sees matches the logic.
      // In the new simplified schema, Firestore mainly holds text content, while logic relies on the App Index.
      // However, for the "Reveal" screen, we want accurate data.
      hints: [
        { type: "director", label: "Director", value: directorName },
        // We might lack full Cast/Genre lists in the lightweight Cloud schema,
        // but we can backfill from the local index if needed.
        {
          type: "decade",
          label: "Decade",
          value:
            releaseDate.length >= 4
              ? `${releaseDate.substring(0, 3)}0s`
              : "N/A",
        },
      ],
    }
  }

  private async _fetchGameForDate(
    dateStr: string,
  ): Promise<FirestoreMovie | null> {
    console.log(`[MovieDataService] 🔍 Checking Firestore for date: ${dateStr}`)
    try {
      const dailyGameRef = doc(db, FIRESTORE_COLLECTIONS.DAILY_GAMES, dateStr)
      const dailyGameSnap = await getDoc(dailyGameRef)

      if (!dailyGameSnap.exists()) {
        console.log(`[MovieDataService] ⚠️ No schedule found for: ${dateStr}`)
        return null
      }

      const { movieId } = dailyGameSnap.data()
      if (!movieId) return null

      console.log(`[MovieDataService] 🎬 Fetching Movie ID: ${movieId}`)
      const movieRef = doc(db, FIRESTORE_COLLECTIONS.MOVIES, String(movieId))
      const movieSnap = await getDoc(movieRef)

      if (movieSnap.exists()) {
        const data = movieSnap.data() as FirestoreMovie
        data.id = Number(movieId)
        console.log(`[MovieDataService] ✨ Loaded: ${data.title}`)
        return data
      }
    } catch (error: any) {
      console.error(`[MovieDataService] 💥 Error: ${error.message}`)
    }
    return null
  }

  public async getDailyTriviaItemAndLists(): Promise<{
    dailyItem: TriviaItem
    fullItems: readonly TriviaItem[]
    basicItems: readonly BasicTriviaItem[]
  }> {
    // 1. Generate Static Lists (Instant)
    const basicItems = this.searchIndex.map((m) => this._toBasicItem(m))
    const fullItems = this.searchIndex.map((m) => this._toLogicItem(m))

    // 2. Determine Date (Local Time)
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, "0")
    const d = String(today.getDate()).padStart(2, "0")
    const todayStr = `${y}-${m}-${d}`

    // 3. Fetch Game
    let cloudMovie = await this._fetchGameForDate(todayStr)

    // 4. Fallback: Try Yesterday
    if (!cloudMovie) {
      console.log(`[MovieDataService] Today unavailable. Trying yesterday...`)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const yy = yesterday.getFullYear()
      const ym = String(yesterday.getMonth() + 1).padStart(2, "0")
      const yd = String(yesterday.getDate()).padStart(2, "0")
      const yesterdayStr = `${yy}-${ym}-${yd}`

      cloudMovie = await this._fetchGameForDate(yesterdayStr)
    }

    if (cloudMovie) {
      // Merge Cloud Data (Plot) with Local Data (Hints)
      // We find the matching local item to ensure hints like Actors/Genres are populated
      // even if the simplified Cloud schema doesn't have them.
      const localMatch = this.searchIndex.find((m) => m.i === cloudMovie!.id)
      const dailyItem = this._transformCloudMovie(cloudMovie)

      if (localMatch) {
        // Enrich the display item with detailed hints from local index
        const logicItem = this._toLogicItem(localMatch)
        dailyItem.hints = logicItem.hints
      }

      return {
        dailyItem,
        fullItems,
        basicItems,
      }
    }

    const errorMsg = `Unable to load the daily challenge. Checked ${todayStr} and yesterday.`
    console.error(`[MovieDataService] 🛑 FATAL: ${errorMsg}`)
    throw new Error(errorMsg)
  }

  public async getItemById(id: number | string): Promise<TriviaItem | null> {
    // 1. Try Local First (Fastest, for history/lists)
    const localMatch = this.searchIndex.find((m) => m.i === Number(id))

    // 2. Try Cloud (For full plot details)
    try {
      const movieRef = doc(db, FIRESTORE_COLLECTIONS.MOVIES, String(id))
      const movieSnap = await getDoc(movieRef)
      if (movieSnap.exists()) {
        const data = movieSnap.data() as FirestoreMovie
        data.id = Number(id)
        const item = this._transformCloudMovie(data)

        // Enrich with local hints if available
        if (localMatch) {
          const logicItem = this._toLogicItem(localMatch)
          item.hints = logicItem.hints
        }
        return item
      }
    } catch (error) {
      console.error("Error fetching item by ID:", error)
    }

    // 3. Fallback: Return Local Data Only (No Plot)
    if (localMatch) {
      return this._toLogicItem(localMatch)
    }

    return null
  }
}
