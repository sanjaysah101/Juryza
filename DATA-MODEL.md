# DATA-MODEL.md — schema, and the way in and out

The whole schema is one file: `apps/juryza/src/lib/db/schema.ts` (Drizzle,
PostgreSQL 18). Every id is text with a type prefix (`evt_`, `prj_`, `tm_`,
`scr_` …) so a value in a log or CSV says what it is; imported rows keep their
original ids when free (fixture ids such as `prj_01` survive), so references
line up with the source data.

## Entity relationship

```
                               ┌─ track ◄──────────────┐
                               ├─ prize (overall|track|community)
                               ├─ rubric_criterion (weighted)
 event ─────────────────────── ├─ registration ──► user
   │                           ├─ announcement
   │                           ├─ event_judge ──► user   (panel + track limits)
   │                           ├─ judge_invite            (email-bound link)
   │                           ├─ webhook ─► webhook_delivery
   │                           └─ certificate ──► user
   │
   ├─ team ─── team_member ──► user
   │     └──── project ────────────────────────┐
   │              ├─ assignment  (judge, project, unique)
   │              ├─ score       (judge, project, unique; marks per criterion)
   │              ├─ pairwise_vote (judge, winner, loser)
   │              ├─ vote        (voter_key, project, unique; quadratic votes)
   │              └─ comment
   ├─ voter (email-verified voting sessions)
   └─ audit_log (append-only)

 user ─ session, account, verification (Better Auth) · api_token (hashed)
```

## Tables

### Identity
- **user** — Better Auth's user plus the platform `role`
  (`participant | judge | organizer | admin`; a visitor is simply
  unauthenticated) and the public profile: `username` (unique handle used in
  `/u/<username>` and `?judge=` selectors), `headline, bio, location,
  websiteUrl, githubUrl, skills[], lookingForTeam`, `banned`.
- **session, account, verification** — Better Auth's standard tables.
- **api_token** — `tokenHash` (SHA-256), `prefix` (for display), `label`,
  `lastUsedAt`. The raw token is shown once and never stored.

### Events
- **event** — `slug`, `name`, `tagline`, rich `content` (overview) and `rules`
  (editor JSON), plain `description` (search), `mode`/`location`, cover `hue`,
  `visibility` (`draft|published`), the lifecycle dates
  (`submissionsOpen/Close`, `judgingClose`, `votingOpen/Close`),
  `resultsPublished`, and configuration: `maxTeamSize`, `reviewsPerProject`,
  `votingAccess` (`open|email|authenticated`), `votingEmailDomains[]`,
  `voteBudget`, `createdBy` (the managing organizer).
  The phase is **derived** from dates (`lib/phase.ts`), never stored, so it
  cannot drift from the deadline checks.
- **track** — categories, ordered.
- **prize** — awarded by overall judged rank, rank within a track, or community
  vote. Winners are computed, not stored.
- **rubric_criterion** — `key, label, description, weight, position`. Weights
  are relative; marks are stored per `key`, so re-weighting never invalidates
  them.
- **registration** — who takes part. Creating or joining a team registers you.
- **announcement** — organizer updates, optionally pinned.

### Teams and projects
- **team** — `name, description, lookingForMembers, inviteToken` (the invite
  link capability; resettable).
- **team_member** — `(team, user)`, `role owner|member`. One team per person per
  event is enforced by the API.
- **project** — one per team: `title, tagline`, rich `content` plus derived plain
  `description`, `thumbnailUrl, repoUrl, liveUrl, videoUrl, techTags[]`,
  `status draft|submitted`, `submittedAt`.

### Judging
- **event_judge** — the panel; `trackIds[]` limits a judge to tracks (empty =
  all).
- **judge_invite** — `email, token, trackIds, acceptedBy/At`.
- **assignment** — `(judge, project)` unique, `batch`.
- **score** — `(judge, project)` unique; `criteria` is `{ key: 1..5 }`. Weighted
  and normalized values are computed on read (`lib/server/results.ts`).
- **pairwise_vote** — append-only verdicts for Bradley–Terry.

### Community
- **vote** — `(project, voterKey)` unique, `votes` (cost = votes²),
  `ipAddress`. `voterKey` is `user:<id>`, `email:<address>` or `anon:<hash>`.
- **voter** — email-gated voting: hashed one-time code, attempts, hashed
  session secret, `verifiedAt`.
- **comment** — author, body.

### Operations
- **audit_log** — `actorId/Name/Role, action, target, detail (json), ipAddress,
  createdAt`; indexed by event and time.
- **webhook / webhook_delivery** — subscriptions (per-hook secret, event-type
  filter) and every delivery attempt with status.
- **certificate** — `serial`, subject, `kind (judge|winner)`, `statement`,
  `reviewsCompleted`, `issuedAt`, `signature` (HMAC-SHA256).

## Why this shape

- **Multi-event from the root.** Everything hangs off `event`, so one install
  runs many hackathons; per-event permissions come from `event.createdBy` and
  `event_judge`, not global flags.
- **Derived, never duplicated.** Phase, weighted scores, normalized scores,
  ranks, awards and tallies are computed on read from primary facts. There is
  no cache to invalidate and no way for two screens to disagree.
- **Uniqueness constraints carry the integrity rules** — one score per judge
  per project, one vote row per voter per project, one assignment per pair.
- **Rich text as JSON.** Stored as the editor's document and rendered through a
  fixed schema: safe by construction, and the plain-text shadow column keeps
  search and similarity cheap.

## Migration paths

### Out
- **Per-dataset exports** at every stage (`GET /api/events/:event/export?dataset=…&format=csv|json`):
  participants, teams, projects, assignments, scores (one column per
  criterion), results (raw, normalized, ranks, per-criterion means, votes,
  pairwise, awards), votes (with IP), comments, audit. CSV is
  spreadsheet-safe.
- **Full bundle** (`GET /api/events/:event/bundle`) — one JSON file with the
  event, tracks, rubric, prizes, judges, teams (members by email), projects
  (with rich content), scores and pairwise verdicts.

### In
- `POST /api/events/import` (or the console's *Import & export* page) creates a
  new draft event from a bundle. **The bundle format is a superset of the
  DOGFOOD `fixtures.json` shape**, so a Juryza export, the fixtures file, and
  any hand-written converter from another platform all import the same way.
  Ids are kept when free and remapped on collision; people are matched by email
  and missing accounts are created (password set via reset). The response
  reports what was created and what was skipped.
- The seed uses exactly this importer for the fixture event, so the migration
  path is exercised on every boot.

## Schema changes

The container runs `drizzle-kit push` at start (idempotent, offline). For a
long-lived production database, generate reviewed SQL migrations instead:
`bun run --cwd apps/juryza db:generate`.
