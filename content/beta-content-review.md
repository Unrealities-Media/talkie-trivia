# Beta content review

Reviewer: `codex-beta-review` (AI review, not a claimed human sign-off).
Scope: 40 movie sets / 200 clues for the user's explicitly authorized hosted beta.
The production approval pool remains separate. Publish using
`-reviewed ../../content/beta-reviewed-movies.json`.

Reviewed the original synopses and four adaptations for each movie, compared
source IDs/original wording with the repository TMDB snapshot and released
catalog, and checked central plot fidelity, increasing ambiguity, gender/location
removal at Medium, title/name leakage, and explicit content. The pipeline also
validates hashes, lengths, catalog membership, and title/alias leaks.

Changes before publication:

- Replaced Memento with Casablanca because Memento's verbatim original includes
  an explicit sexual-assault reference. The original-synopsis rule precludes
  silently sanitizing that level.
- Removed the character names Joy and Sadness from Inside Out's Easy clue.

The review flags represent suitability of the clue text for this general beta,
not a film age rating or a legal certification of upstream licensing. Some
synopses still mention death, violence or romance. Very Easy intentionally
retains names, title references, and source wording under the requested rule.
Hard and Very Hard intentionally admit multiple plausible interpretations;
their fairness requires tester feedback. No claim is made that blind difficulty
or solved percentages have been calibrated.

Source drafts remain unapproved in `beta-movies.json`; the publication copy
records this review with its actual timestamp. TMDB attribution stays in the app.

## October 16 UTC refill review

Added ten distinct movies (50 clue variants), bringing the beta pool to 50 sets:
Zootopia, The Incredibles, The Martian, The Lego Movie, The Iron Giant,
Fantastic Mr. Fox, Paddington, Chicken Run, School of Rock, and The Terminal.
Reviewer remains `codex-beta-review`: this is AI review for the invited beta,
not human editorial approval or a change to the production pool.

Compared every adaptation with its stored source synopsis and checked the full
five-level progression. Very Easy preserves source wording, including promotional
language in Chicken Run. Easy removes names and explicit brand identifiers;
Medium removes gender and named places. Hard removes distinctive settings,
species and mechanisms; Very Hard keeps a short causal conflict. No new outside
facts, ratings or licensing claims were introduced. References to danger,
political upheaval and presumed death remain non-graphic. The new clues still
need blind playtest feedback to assess difficulty and ambiguity.

These additions are intended for the ten missing October 22–23 slots. Publication
must use a fresh preview, retain existing immutable challenges, and follow the
reviewed-PR workflow. Adding entries here does not itself publish them.
