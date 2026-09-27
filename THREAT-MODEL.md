# THREAT-MODEL.md — voting & submission abuse

A written, deliberately honest threat model for Juryza (Threat Model bonus). It
names the attacks we stopped, and the ones we did not. The honest list is worth
more than the heroic one.

## Assets & trust boundaries

- **Backend API** (`apps/juryza/src/app/api/**`) is the only trust boundary that
  matters. The UI is untrusted: every authorization decision is made server-side
  in `lib/api-auth.ts`, and the acceptance suite verifies this with a `curl`, not
  a click.
- **Credentials.** Bearer `api_token` rows (long, random, `nanoid(32)`) and
  Better Auth session cookies. The signing/HMAC key is `BETTER_AUTH_SECRET`
  (or `SIGNING_SECRET`).
- **Data at risk.** Judges' scores (must stay isolated), the vote tally (must not
  be gameable), and results before publication (must stay hidden).

## Attacks addressed

### Judge collusion / score leakage
- **Backend role isolation.** `/api/judge/scores` returns only the caller's
  scores; requesting `?judge=<other>` is refused 403. A participant hitting it is
  403. Verified by acceptance checks T2.03–T2.05 and by direct curl.
- **Assignment scoping.** A judge can only score/compare projects assigned to
  them; the check reads the `assignment` table, not a hidden UI state.
- **Track isolation.** A track judge is never assigned another track's projects.

### Ballot stuffing (community voting)
- **Duplicate detection.** A unique `(project, voter_key)` constraint means a
  second vote updates rather than stacks. `voter_key` is the user id when
  authenticated, else a per-IP key.
- **Rate limiting.** Fixed-window per-IP limit (30 votes/min) blunts scripted
  stuffing (`lib/rate-limit.ts`).
- **Quadratic cost.** Even with many identities, concentrating influence on one
  project is sub-linear (`sqrt(credits)`), so a Sybil fleet buys less than it
  costs.
- **Randomized ballots** remove the position-bias an attacker could exploit by
  submitting first.

### Deadline gaming
- **Submission close is enforced in the backend.** `POST /api/projects` and
  `PATCH` are refused once `submissions_close` has passed (organizers excepted,
  for data fixes). The acceptance suite's closed-event check exercises exactly
  this. No client clock is trusted.

### Result leakage before publication
- `/api/results` and `/api/results/pairwise` return nothing to non-organizers
  until `resultsPublished` is set — so the standings can't be watched mid-window
  or scraped early.

### Tampering with issued records
- **Certificates are HMAC-signed** over canonical fields; the public verify
  endpoint recomputes the HMAC, so editing `reviewsCompleted` or the name makes
  `valid: false`. Webhook deliveries are signed the same way so a receiver can
  reject spoofed calls.

### Auditability
- Every consequential action writes a human-readable `audit_log` row an organizer
  can read at `/api/organizer/audit` — collusion or abuse leaves a trail.

## Attacks NOT fully addressed (honest list)

- **Sybil registration.** Sign-up is open and there is no email verification in
  the offline demo (no mail server). A determined attacker can mint accounts to
  vote. Mitigations in place (quadratic cost, rate limits, dedupe) raise the cost
  but do not eliminate it. Production fix: email verification + per-account vote
  budgets; both are Better-Auth-native and noted as future work.
- **Distributed IP rotation.** The rate limiter is per-IP and in-process; a
  botnet across many IPs, or a multi-instance deployment, defeats it. Production
  fix: move the counter to shared storage (Better Auth already supports a Redis
  `secondaryStorage`) and add per-account limits.
- **Organizer trust.** An organizer can publish, assign, and export freely — the
  model trusts the organizer role. Cross-organizer isolation (multi-tenant) is
  not implemented; this is a single-tenant portal per deployment.
- **Submission scraping.** The gallery is public by design (it must be), so
  submitted project metadata is readable. We rate-limit writes, not public reads.
- **Timing side channels** in auth comparisons: token lookup is a DB equality
  check, not constant-time; certificate/webhook signature checks use
  `timingSafeEqual`, auth-token lookup does not. Low risk given token entropy.

## Residual risk summary

The judging layer (isolation, deadline, results-hiding, audit) is hardened in the
backend and verified. The community-voting layer is *raised-cost*, not
*attack-proof*, against a motivated Sybil adversary — which matches the reality
that one-person-one-vote is conceded-gameable industry-wide, and quadratic voting
is the most credible shipped mitigation rather than a cure.
