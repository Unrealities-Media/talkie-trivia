import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { CatalogMovie } from "./gameEngine"

const data = readFileSync(join(__dirname, "../assets/searchIndex.json"))
export const catalogVersion = createHash("sha256").update(data).digest("hex")
export const catalog = new Map<number, CatalogMovie>(
  (JSON.parse(data.toString("utf8")) as CatalogMovie[]).map(movie => [movie.i, { ...movie, c: movie.c || [] }]),
)
