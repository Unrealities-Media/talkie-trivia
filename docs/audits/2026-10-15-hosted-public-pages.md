# Hosted public-page verification — October 15, 2026

Target: https://talkie-trivia-beta.web.app. HTTP checks completed at
21:44 UTC and isolated Chromium checks at 21:45 UTC. This pass fetched public
resources only: no accounts, gameplay writes, email, deployment or native builds.

## Verified

- `/`, `/game`, `/profile`, `/archive`, `/privacy`, `/support`, and
  `/delete-account` returned HTTP 200 with HTML content.
- All seven responses carried `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex, nofollow`.
- The privacy, support and deletion routes served distinct static documents,
  rather than the app shell. Each contains the public support mail link.
- All three information pages rendered at 1440×900 and 320×900 without
  horizontal overflow or JavaScript exceptions. Each has `lang="en"`, one
  `main` landmark, one descriptive `h1`, and links to the public information pages.
- The deletion page links to `/profile` and the privacy notice. The Profile
  route returned the app shell; authenticated deletion was not exercised.

The previous statement that public support contact and policy/deletion pages
still need to be supplied is stale for this hosted beta. Publication and basic
rendering are verified. Support mailbox delivery, identity verification,
deletion completion, retention behavior, legal review and store disclosures
remain separate acceptance requirements.

## Deployment evidence and limits

The root/app HTML SHA-256 was
`3fc10a6490e86b5343e5af25d3ceaf680db7ab02132b7271311ec439cc033d8e`.
Its initial title is `Talkie Preview`; this does not prove the final title after
React navigation renders. Three referenced initial scripts returned HTTP 200.
The main entry script was `index-5fbfb43c88fc39d7dc03c87d290bdaff.js`, with
SHA-256 `728f2329cc6c1f7cc9764d0a50c76555f67e68e9e3dd8a2f6627d4e76eef3496`.

Initial-script text searches did not locate the pending preview/retry copy, but
lazy-loaded chunks and compiled strings make absence insufficient evidence of
feature behavior. No claim is made that a Git commit matches deployed bytes or
that PRs 13–15 are deployed. The active game's search, restored-tab layout,
real-provider login, share flow and request limits still require deployed
runtime verification after the release candidate is approved.

This pass did not read the private published schedule. The October 21 end date
is the earlier recorded schedule horizon, not a freshly queried live result.
Use the read-only check from PR 15 with the deployed catalog and an authorized
read identity before relying on that date or planning more content.

## Review state at this checkpoint

- PR 13 (keyboard movie previews): all remote checks passed.
- PR 14 (gameplay limits and browser retry): the updated head is
  `135d53faffa16444c203f2ad703cf98f9096b224`; its checks were running.
- PR 15 (schedule readiness): app, browser, emulator, Go and CodeQL checks
  passed; the existing full-history secret scan was still running.

These are time-stamped observations, not substitutes for checking the final
heads before merging. Keep native verification disabled during the web beta.

Local raw evidence is in ignored `.expo/hosted-beta-audit.json` and
`.expo/hosted-public-pages.json`. The recorded checks above are portable; those
local files are not part of a fresh clone.
