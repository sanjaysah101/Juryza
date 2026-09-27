# DATA-MODEL.md — schema, and the way in and out

The full schema is one file: `apps/juryza/src/lib/db/schema.ts` (Drizzle,
PostgreSQL). Every id is a text string with a short type prefix (`evt_`, `prj_`,
`tm_`, …) so a value read from a log or CSV tells you what it is; seeded fixture
rows keep their original ids (`prj_01`, `jdg_03`) so foreign keys line up with
the acceptance suite.

## Entity relationship

```
user ──1:N── team_member ──N:1── team ──N:1── event
  │                                   │           │
  │ (role: visitor|participant|       │           ├─1:N─ track
  │  judge|organizer|admin)           │           ├─1:N─ prize
  │                                   │           └─1:N─ rubric_criterion (weighted)
  ├─1:N── api_token (bearer creds)    │
  ├─1:N── judge_tracks ──► track      └─1:N─ project ──N:1── track
  │                                              │
  ├─1:N── assignment ──► project ◄───────────────┤ (judge ↔ project)
  ├─1:N── score      ──► project ◄───────────────┤ (unique judge+project)
  ├─1:N── pairwise_vote (winner, loser) ─────────┤
  └─1:N── certificate                             │
                                       vote ──────┤ (unique project+voter_key)
                                       comment ───┤
                        webhook ─1:N─ webhook_delivery
                        audit_log (append-only)
```

## Tables

### Identity (owned by Better Auth + admin plugin)
- **user** — `id, name, email, emailVerified, role, banned, …`. `role` is the
  five-role model; default `participant`. A *visitor* is an unauthenticated
  request, not a stored role.
- **session, account, verification** — Better Auth's standard tables.
- **api_token** — `token, userId, label`. Long-lived bearer credentials; the four
  seeded ones are what the acceptance checker uses.

### Event configuration
- **event** — dates (`submissionsOpen/Close`, `votingOpen/Close`),
  `resultsPublished`. The seeded fixture event has a **past** submissions close
  (so submissions are refused, per the acceptance check) and an **open** voting
  window (so T3 is demonstrable).
- **track**, **prize** — per-event, organizer-defined.
- **rubric_criterion** — `key, label, weight, position`. The **weighted** rubric;
  weights are arbitrary positive numbers, normalized to sum to 1 at compute time.
- **judge_tracks** — which tracks a judge may review (empty = generalist). Drives
  track-isolated assignment.

### Submissions
- **team** — per event, with a single `inviteToken` (invite-link formation; no
  heavyweight invitation/acceptance flow by design).
- **team_member** — `(teamId, userId)` PK, role owner|member.
- **project** — the full submission field set (title, tagline, summary,
  description, thumbnail, gallery, video/repo/live URLs, tech tags, custom
  answers), plus `status` (draft|submitted) and `submittedAt`.

### Judging
- **assignment** — `(judgeId, projectId)` unique. Who reviews what.
- **score** — `(judgeId, projectId)` unique; `criteria` is a JSON map of
  per-criterion marks. Aggregates are computed on read, never stored.
- **pairwise_vote** — append-only `(winner, loser)` comparisons for Bradley–Terry.

### Public (T3)
- **vote** — `(projectId, voterKey)` unique; `credits` for quadratic tally.
- **comment** — gallery comments.

### Operational (T2–T4)
- **audit_log** — append-only, human-readable. Every score/assignment/export/
  vote/publish/role change.
- **webhook / webhook_delivery** — subscriptions and signed delivery attempts.
- **certificate** — signed, publicly verifiable participation records.

## Getting data IN

1. **Fixtures at boot.** `seed.ts` loads `fixtures.json`, creating the event,
   tracks, judges (as real users), teams, projects, scores, and derived pairwise
   comparisons. Idempotent: it truncates first, so `docker compose up` is always
   the same known state. It transforms the fixture shape into the schema — the
   file is *input*, not the storage model.
2. **Bulk import.** `POST /api/organizer/import` accepts an event bundle (the
   shape `export.json` produces, or a hand-authored subset) and creates a **new**
   event with fresh, remapped ids — an import never clobbers an existing event.
3. **The API / UI.** Events, teams, projects, scores, votes are all created
   through the documented REST endpoints (`/api/openapi.json`).

## Getting data OUT

1. **CSV** — `GET /api/organizer/export.csv`: one row per project with raw mean,
   normalized mean, review count, rank. The acceptance suite's export check.
2. **Full JSON** — `GET /api/organizer/export.json`: the entire event graph
   (tracks, prizes, rubric, teams, members, projects, assignments, scores, votes,
   comments) — round-trips into `import`.
3. **Audit log** — `GET /api/organizer/audit`: the operational record.
4. **Certificates** — `GET /api/certificates/{serial}`: signed records, publicly
   verifiable.

"A platform you cannot leave is a trap." Every table is reachable through an
export, and the JSON export + import form a complete migration path.

## Notable modelling decisions

- **Ids keep fixture values.** Seeded rows reuse `fixtures.json` ids so the
  acceptance suite and any manual inspection line up; only newly created rows get
  fresh prefixed ids.
- **No pre-aggregated scores.** Re-weighting the rubric or a late edit never
  leaves stale numbers, because every aggregate is derived on read from `score`.
- **`criteria` as JSON**, not a row-per-mark table: the mark set is small,
  always read together, and mirrors the fixture shape exactly — a join per score
  would buy nothing.
- **Unique `(judge, project)` on score and assignment** makes double-scoring and
  double-assignment impossible at the database level, not just in code.
