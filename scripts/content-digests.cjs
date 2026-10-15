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
  let text = `${item.movieId}\n${item.description}\n${item.imdbId}\n${item.tagline}`;
  if (item.clues) {
    const levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5'];
    if (Object.keys(item.clues).length !== 5 || levels.some(level => typeof item.clues[level] !== 'string') || item.clues.LEVEL_1 !== item.description) throw new Error('Expected five clue variants with LEVEL_1 equal to description');
    text = `clues-v2\n${text}\n${levels.map(level => item.clues[level]).join('\n')}`;
  }
  return { movieId: item.movieId, contentHash: createHash('sha256').update(text).digest('hex') };
}), null, 2));
