# Clue wording by difficulty

Product direction from the operator: clue vagueness becomes part of the five
gameplay difficulty levels. Implemented for new schema-2 daily publications;
existing schema-1 content and saved games retain their original text.

| Level | Label | Wording rule |
| --- | --- | --- |
| 1 | Very Easy | Exact original TMDB synopsis, including any identifiers present in the source. |
| 2 | Easy | Remove character names, movie titles and aliases, and other direct identifiers while preserving concrete plot details. |
| 3 | Medium | Additionally neutralize gender and remove named locations and similarly identifying context. Preserve the central premise and causal relationships. |
| 4 | Hard | Express the underlying conflict without signature objects, species, settings or explicit genre mechanics. The eight revised beta drafts are starting examples. |
| 5 | Very Hard | Shorten and abstract the Hard clue further, retaining a meaningful relationship or conflict rather than an arbitrary generic phrase. |

The existing five difficulty IDs now use these wording levels alongside the
unchanged hint, guess and score rules. Basic is renamed Very Easy and Extreme is
renamed Very Hard. Very Hard displays its short clue in full from the start;
the other levels continue revealing text gradually.

Publish five stable variants for each movie. Each UTC day has five different
answers, one per difficulty, shared by all players. Players can switch freely
between challenges after saving pending moves; each resumes its own progress.
Schedule and player game IDs include both date and difficulty
(`YYYY-MM-DD_LEVEL_N`). Legacy date-only history remains readable.

Completing any challenge, including a loss, maintains the daily completion
streak. Multiple completions on one date count as one streak day. Record games,
wins and scores by difficulty, plus dates when all five were completed.
 Select and snapshot the
chosen variant on the server when starting a game; preserve it when resuming.
Do not generate different wording for different players on each request.
Review the five variants as one content set, including difficulty progression,
accuracy and ambiguous adaptations. Existing published games must retain their
original snapshots.

The publication input requires `clues.LEVEL_1` through `clues.LEVEL_5`.
`description` remains the original synopsis and must equal `clues.LEVEL_1`.
The original retains its 100–2500 character validation; each variant allows
20–2500 characters. The publisher checks title/alias leaks in levels 2–5 and
taglines, deliberately exempting the verbatim original. Semantic vagueness and
character-name removal require editorial assessment, not substring rules.

Schema-2 hashes cover all five variants in fixed level order with the
`clues-v2` prefix. The backend validates the full set before selecting a clue;
only the selected description is copied into the player's game. Legacy
schema-1 hashes remain readable; the publisher never replaces scheduled dates.

`content/beta-movies.json` contains 40 draft sets (200 clues), with source
references to the repository's TMDB snapshot. `content/beta-clue-drafts.md`
provides the readable review copy. They are not marked approved. Local emulator
seeding uses these drafts; existing emulator dates remain immutable, so use an
unscheduled date to see new variants. Live publication still reads the approved
pool in `content/reviewed-movies.json`.

Playtest the combined effect of vague wording, gradual reveal, fewer guesses and
reduced hints. In particular, a short Very Hard clue must remain meaningful when
displayed through the existing reveal mechanism. Resolve remake ambiguity with
player-visible information or an explicit acceptance policy.
