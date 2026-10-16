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

## October 24–25 refill review

A read-only inventory on October 16 found 50 scheduled slots, 50 distinct movies,
and no unused reviewed sets. All 40 slots for October 16–23 were valid. Added ten
sets (50 variants), bringing the beta pool to 60 movies: Cool Runnings,
Mrs. Doubtfire, Roman Holiday, How to Train Your Dragon (2010), Hugo,
The Grand Budapest Hotel, Chef, The Intern, Hidden Figures, and Klaus.

Reviewer: `codex-beta-review`, an AI editorial review for the invited beta.
Compared adaptations against the repository source synopses and catalog IDs.
Very Easy retains each source verbatim. Easy removes character names and direct
title identifiers; Medium removes named locations and gender; Hard removes
distinctive settings and mechanisms; Very Hard retains a causal conflict.
Source wording includes separation, parental loss, discrimination, conflict,
and a sedative, but no graphic description. Suitability flags apply to clue text,
not film age ratings or rights clearance. Blind difficulty calibration remains
dependent on player feedback.

Excluded both Karate Kid versions from this refill because the abstract variants
would not fairly distinguish the remakes. Excluded Singin' in the Rain because
its stored original synopsis is shorter than the publication minimum. No source
synopsis was expanded or rewritten to bypass that requirement.

Drafts remain unapproved; only the separate beta publication copy records this
review. The production pool and released catalog are unchanged. Publication must
preview ten new slots for October 24–25 and preserve every existing snapshot.
