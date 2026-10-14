// Read-only helper. A digest binds the reviewed text; it is not an approval.
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/content-digests.cjs <reviewed-or-draft-json>');
const entries = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(entries)) throw new Error('Expected an array of clue drafts');
console.log(JSON.stringify(entries.map(item => {
  if (!Number.isSafeInteger(item.movieId) || item.movieId <= 0 ||
      ['description', 'imdbId', 'tagline'].some(key => typeof item[key] !== 'string')) {
    throw new Error('Each draft requires movieId, description, imdbId and tagline');
  }
  return { movieId: item.movieId, contentHash: createHash('sha256')
    .update(`${item.movieId}\n${item.description}\n${item.imdbId}\n${item.tagline}`).digest('hex') };
}), null, 2));
