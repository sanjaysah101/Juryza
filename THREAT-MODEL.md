# THREAT-MODEL.md — what we defend, what we don't

An honest threat model: the attacks Juryza stops, how, and the ones it does
not. The honest list is worth more than the heroic one.

## Assets and the trust boundary

- **The API is the only trust boundary.** Every route under
  `apps/juryza/src/app/api/**` resolves the caller (`lib/server/identity.ts`)
  and checks permission itself (`lib/server/events.ts` for per-event rules).
  The UI is untrusted; it hides nothing that the API would otherwise hand out.
  The app's own pages use the same REST API as any client.
- **Credentials.** Better Auth session cookies (HTTP-only, SameSite=Lax) and
  personal API tokens (`jz_` + 40 random characters, **stored only as SHA-256
  hashes**, shown once, revocable, with last-used time).
- **Secrets.** `BETTER_AUTH_SECRET` signs sessions; `SIGNING_SECRET` (falls
  back to it) signs certificates. Each webhook has its own secret.
- **Data at risk.** Judges' scores (isolation), vote tallies (integrity),
  results before publication (secrecy), submissions after the deadline
  (fairness), and people's email addresses (privacy).

## Attacks addressed

### Judge collusion and score leakage
- **Cross-judge reads are refused in the backend.** `GET /api/judge/scores`
  returns only the caller's scores; `?judge=<anyone else>` is a 403 decided
  before any query runs, and the attempt is audited (`judge.scores.denied`).
  Callers on no judging panel (participants) get 403. Verified by the
  acceptance suite with curl and by the integration tests.
- **Assignment scoping.** Scores and pairwise verdicts are only accepted for
  projects assigned to the caller.
- **Conflicts of interest.** The planner never assigns a judge a project from a
  team they are on.
- **Per-judge calibration is organizer-only**; the public leaderboard shows
  normalized aggregates, never individual judges' marks.
- **Late score edits.** Scoring closes at `judgingClose` and when results are
  published; every save is audited with the marks given.

### Ballot stuffing and Sybil voting
- **Access modes per event** — signed-in accounts, email-verified voters
  (one-time 6-digit code, 15-minute expiry, 5 attempts, optional domain
  allowlist), or open link. Organizers pick the strength they need.
- **Quadratic budget, enforced server-side.** Each voter has a fixed credit
  budget; `v` votes cost `v²`. Checked inside a transaction under a per-voter
  advisory lock, so parallel requests cannot overspend. A Sybil fleet buys
  linearly more identities for sub-linear influence per project.
- **Duplicate detection.** Unique `(project, voter_key)` — re-voting updates,
  never stacks. Open-link voting caps anonymous voters at 3 per network per
  event (`vote.blocked.ip_cap` is audited).
- **Rate limits** per IP and per voter on votes; per IP and per address on
  verification codes; per user on comments; Better Auth limits sign-in (10/min)
  and sign-up (5/min).
- **No self-votes** — voting for your own team's project is refused.
- **Randomized ballots** (per-voter seed) remove position bias an early
  submitter could exploit.
- **Integrity dashboard** — organizers see voters by kind, voters sharing a
  network, and burst minutes, and can export every vote with its IP.

### Deadline gaming
- **Submission close is enforced in the backend** for creating, editing,
  submitting and withdrawing projects, and for team formation and roster
  changes (teams lock at the deadline so rosters cannot be reshuffled after
  judging starts). Only the event's organizers can edit afterwards (for data
  fixes), and that is audited. No client clock is trusted.

### Result leakage
- `GET /api/events/:event/results` returns no numbers to anyone but the event's
  organizers until publication. Publishing is **refused while voting is open**
  (or explicitly closes voting), so a live vote can never see standings.
- Ballots never contain tallies; the live tally endpoint is organizer-only.

### Privilege escalation and cross-event access
- Event management requires being that event's creator or a platform admin;
  the `organizer` role alone only grants creating events. Draft events 404 for
  everyone else (no existence leak).
- Only admins change roles or suspend accounts; admins cannot demote
  themselves, so an instance always keeps one. Suspension revokes sessions and
  tokens stop resolving immediately.
- Judge invitations are bound to the invited email: a forwarded link does not
  work for another account.

### Content injection
- **Rich text is stored as ProseMirror JSON and rendered through a fixed
  schema** — no user HTML reaches the page. Links are limited to
  `http(s)`/`mailto`, images to `http(s)`.
- **CSV formula injection** — cells starting with `= + - @` are prefixed, since
  organizers open exports in spreadsheets and titles are attacker-controlled.
- **Clickjacking** — every page sends `X-Frame-Options: DENY` except the
  embeddable gallery, which is read-only by design.
- Video embeds are built from a parsed id, never from the raw URL.

### Tampering with records
- **Certificates** are HMAC-SHA256 over the canonical record (serial, event,
  subject, kind, statement, review count, issue time); the public verifier
  recomputes it, so any edited field reads as invalid.
- **Webhooks** are signed per subscription (`X-Juryza-Signature: sha256=…`),
  and the secret is shown once.

### Auditability
- Every consequential action — score saved, assignments generated, export
  downloaded, role changed, vote cast, denied cross-judge read, rejected late
  submission — writes an `audit_log` row with actor, role, target, detail and
  IP. Organizers filter and export it from the event console.

## Attacks NOT fully addressed (honest list)

- **Determined Sybils in open or account mode.** Sign-up is open and the
  offline build has no mail server, so an attacker can create many accounts.
  Budgets, dedupe and rate limits raise the cost; they do not prevent it. Use
  email-verified voting with a domain allowlist when it matters.
- **Distributed IP rotation / multi-instance.** Rate limits and the anon-per-IP
  cap are keyed by IP and kept in process memory. A botnet, or running several
  app instances, defeats them. Fix: shared counter storage (Redis) and
  per-account limits.
- **Organizer trust.** An event's organizers can publish, assign, edit
  submissions after the deadline and export freely — the model trusts them (all
  of it is audited, none of it is prevented).
- **Webhook SSRF.** Organizers can point webhooks at any URL, including internal
  addresses reachable from the server. Acceptable for a single-tenant
  self-hosted install; a shared deployment should add an egress allowlist.
- **Email codes are logged, not mailed**, in the offline build (as are password
  reset links). Anyone with server-log access can read them.
- **Submission scraping.** The gallery is public by design.
- **Judge-to-judge collusion outside the platform** (agreeing marks by chat)
  cannot be prevented; calibration flags and the audit trail make it visible
  after the fact, not impossible.

## Residual risk

The judging layer — isolation, assignment scoping, deadline, results secrecy,
audit — is enforced in the backend and covered by tests. Community voting is
*raised-cost, not attack-proof*: that is the honest state of the art for public
votes, and the organizer chooses how much friction to trade for integrity.
