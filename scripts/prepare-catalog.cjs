// Package the exact app catalog with Functions; keep one editable source of truth.
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs")
const { resolve } = require("node:path")
const { createHash } = require("node:crypto")
const root = resolve(__dirname, "..")
const bytes = readFileSync(resolve(root, "src/data/searchIndex.json"))
const movies = JSON.parse(bytes)
const ids = new Set()
for (const movie of movies) {
  if (!Number.isSafeInteger(movie.i) || ids.has(movie.i) || !movie.t || !/^\d{4}$/.test(movie.y) || (movie.c != null && !Array.isArray(movie.c)) || !Array.isArray(movie.g)) {
    throw new Error(`Invalid or duplicate catalog movie: ${movie.i}`)
  }
  ids.add(movie.i)
}
mkdirSync(resolve(root, "functions/assets"), { recursive: true })
writeFileSync(resolve(root, "functions/assets/searchIndex.json"), bytes)
const version = createHash("sha256").update(bytes).digest("hex")
writeFileSync(resolve(root, "src/data/catalogVersion.json"), JSON.stringify({ version }) + "\n")
console.log(`Prepared ${movies.length} movies, catalog ${version.slice(0, 12)}`)
