import { API_CONFIG } from "../config/constants"

export const imdbTitleUrl = (id: unknown): string | null =>
  typeof id === "string" && /^tt\d{7,12}$/.test(id) ? `${API_CONFIG.IMDB_BASE_URL_TITLE}${id}` : null

export const imdbPersonUrl = (id: unknown): string | null =>
  typeof id === "string" && /^nm\d{7,12}$/.test(id) ? `${API_CONFIG.IMDB_BASE_URL_NAME}${id}` : null
