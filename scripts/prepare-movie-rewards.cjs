// Presentation-only metadata. Never changes the search catalog, clues or scores.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const imagePath = value => typeof value === 'string' && /^\/[\w.-]+\.(jpg|png|webp)$/.test(value) ? value : undefined

function buildRewards(catalog, movies, popular, actors) {
  const originals = new Map(movies.map(movie => [movie.id, movie]))
  const recent = new Map(popular.map(movie => [movie.id, movie]))
  return Object.fromEntries(catalog.map(movie => {
    const original = originals.get(movie.i)
    const current = recent.get(movie.i)
    const credits = [...(current?.actors || []), ...(actors[movie.i] || [])]
    const portraits = Object.fromEntries((movie.c || []).flatMap(name => {
      const person = credits.find(person => person.name === name && imagePath(person.profile_path))
      return person ? [[name, person.profile_path]] : []
    }))
    return [movie.i, {
      ...(imagePath(original?.backdrop_path) ? { backdrop: original.backdrop_path } : {}),
      ...(current?.original_overview || original?.overview ? { summary: current?.original_overview || original.overview } : {}),
      ...(current?.tagline || original?.tagline ? { tagline: current?.tagline || original.tagline } : {}),
      ...(Object.keys(portraits).length ? { portraits } : {}),
    }]
  }).filter(([, reward]) => Object.keys(reward).length))
}

if (require.main === module) {
  const rewards = buildRewards(read('src/data/searchIndex.json'), read('data/movies.json'), read('data/popularMovies.json'), read('data/movieActors.json'))
  const output = JSON.stringify(rewards) + '\n'
  const file = path.join(root, 'src/data/movieRewards.json')
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(file, 'utf8') !== output) throw Error('Run node scripts/prepare-movie-rewards.cjs to refresh reward metadata.')
  } else fs.writeFileSync(file, output)
  console.log(`Reward metadata: ${Object.keys(rewards).length} movies, ${Buffer.byteLength(output)} bytes.`)
}
module.exports = { buildRewards }
