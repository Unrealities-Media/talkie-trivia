# Editorial content

`reviewed-movies.json` is the publication input. It is intentionally empty until
real clues have been reviewed. Tests use fictional fixtures elsewhere; they do
not authorize production content.

Each entry has this shape (replace every example value):

```json
{
  "movieId": 123,
  "description": "A reviewed, accurate clue of 100–2500 characters, without the answer title.",
  "imdbId": "",
  "tagline": "",
  "catalogVersion": "SHA-256 of the exact released searchIndex.json bytes",
  "contentHash": "SHA-256 from the digest helper below",
  "reviewedBy": "editor-handle",
  "reviewedAt": "2026-10-13T12:00:00Z",
  "approved": false,
  "ageAppropriate": false,
  "factsChecked": false
}
```

Review the clue as players see it at each difficulty: factual accuracy, progressive
information, ambiguous remakes, direct/indirect title leaks, disturbing or sexual
content, stereotypes, and whether the answer is reasonably guessable. Short titles
and aliases need human spoiler checks; substring filtering is not sufficient.
Check source/licensing terms separately—TMDB's `adult=false` is neither an age rating
nor a rights clearance. Preview with screen readers and at large text sizes.

The movie must exist in the **released** app catalog. Copy its exact version from
`src/data/catalogVersion.json` after `node scripts/prepare-catalog.cjs`. Generate
digests from drafts without changing their approval fields:

```sh
node scripts/content-digests.cjs content/reviewed-movies.json
```

The digest is SHA-256 over UTF-8 `movieId + "\n" + description + "\n" + imdbId +
"\n" + tagline`, with no trailing newline. Any text/link change needs another
review and digest. Approved entries require a reviewer handle, an RFC3339 review
timestamp no later than publication, and all three review booleans true. Keep
personal contact details out of reviewer handles.

Use a reviewed PR for content changes. Keep enough unused approved movies to fill
the rolling horizon without repeating the preceding 90 days. The default needs
30 future days; initial bootstrap including today needs 31. The publisher will
fail before writing if the pool is insufficient. Publication does not alter
already scheduled days, even when their source entry changes.

See [the publishing runbook](../docs/content-pipeline.md) for preview, deployment,
migration, and incident handling.
