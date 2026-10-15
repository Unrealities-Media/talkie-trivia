# Gameplay request limits

The web beta backend shares one request budget per authenticated Firebase UID
across `startGame`, `applyGameAction`, and `submitGameResult`. It allows a burst
of 30 requests and refills one request every two seconds (30 per minute
sustained). Authentication is checked first; malformed authenticated requests
also consume the budget. The server clock controls refill, not the device clock
or the emulator's adjustable challenge date.

Exhaustion returns `resource-exhausted` with `details.retryAfterMs`. No game or
statistics changes are made by that rejected request. The app explains that the
player should wait briefly and retry. Pending moves keep their original action
ID and revision, including across reload; there is no automatic retry loop.
Acknowledged actions remain idempotent when replayed after a lost response.

The Firestore transaction stores only `tokens` and `updatedAt` at
`players/{uid}/privateRateLimits/gameplay`. Concurrent function instances share
this counter. Clients cannot read, write, or delete it under the existing rules.
The transaction checks deletion and merge barriers before writing, and normal
account deletion recursively removes it with the player's other records.
There is one document per account that uses gameplay; inactive accounts do not
create periodic writes or additional documents. Corrupt counters fail closed
instead of silently resetting the allowance.

## Cost and scope

Each admitted request adds a transaction with three document reads and one
write before the existing game transaction. A throttled request still incurs
function invocation and transaction reads; conflicts can add retry reads.
This bounds accepted work per UID, **not total infrastructure spending**.

Anonymous account rotation, direct Firestore reads, and account lifecycle
endpoints are not covered by this limiter. Keep the invited beta access policy.
Web App Check registration/enforcement, global abuse monitoring and alerts,
staging verification, and a broader retention policy remain public-beta gates.
Account deletion and recovery are deliberately outside the gameplay budget.
No App Check setting, deployment, or native build is part of this change.

## Verification

Backend tests cover a shared cross-route budget, malformed requests, account
isolation, exact refill boundary, refill cap, backward clock movement, corrupt
state, and the deletion barrier. Client tests cover durable replay after
throttling and recovery of the pending UI state.

The isolated Firebase emulator contracts exercise concurrent consumers of the
last token, all three callable endpoints, refill recovery, and client denial of
counter reads/writes/deletion. Run `npm --prefix integration test` from the repository
root for those contracts; use only the isolated demo project configured by the
runner, never production or interactive development data.

Local validation on October 15, 2026 passed: 161 backend tests, 36 focused
client service/state tests (across the initial run and the added state test),
126 emulator contracts, the Go emulator check, app type checking, and lint.
The emulator run explicitly included both new concurrency and rules tests.
Remote CI and deployed behavior are separate acceptance evidence.

The fresh web export also passed all six desktop/mobile browser contracts.
The added recovery scenario injects two callable `RESOURCE_EXHAUSTED` responses,
checks the visible wait/retry state and unchanged guess count, then reloads.
Recovery reaches the real emulator with the identical saved command and consumes
exactly one guess. This tests browser error handling; the actual quota and
concurrency enforcement are covered separately by the backend emulator tests.
