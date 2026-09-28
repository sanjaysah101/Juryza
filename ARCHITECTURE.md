# ARCHITECTURE.md — the shape of the system, and why

## In one paragraph

Juryza is one Next.js 16 application (App Router, React 19, React Compiler)
backed by PostgreSQL 18 through Drizzle, with Better Auth for identity. It ships
as two containers — the app and the database — and `docker compose up` pushes
the schema, seeds the DOGFOOD fixtures plus a live sandbox event, writes
`.dogfood.toml`, and serves on `:8080`, with no network access required. The
REST API and the UI live in the same app, **the UI is built entirely on the
public REST API**, and every authorization decision is made in the API layer.

## Stack and why

| Choice | Why |
| --- | --- |
| Next.js 16 App Router | One deployable for API, dashboard and public site; route handlers for the REST API; server layouts for auth gating. |
| PostgreSQL 18 + Drizzle | Runs locally in a container (no hosted DB); a typed schema in one file; transactions and advisory locks for the vote budget. |
| Better Auth (+ admin plugin) | Self-hosted email/password sessions, rate-limited, with role and ban columns — no auth-as-a-service. |
| TanStack Query | All client data fetching and cache invalidation. |
| Tiptap 3 | The Notion-style editor: block document stored as JSON, rendered through one fixed schema. |
| shadcn/ui on Base UI + Tailwind v4 | Accessible primitives owned as source (`packages/ui`), one token-based theme with light and dark. |
| Bun + Turborepo | Fast installs, one `bun run build/typecheck/lint/test` across the workspace. |

## Request lifecycle and the trust boundary

```
Browser (session cookie) / curl / checker (Bearer token)
        │
        ▼
Route handler  src/app/api/**/route.ts        ← the trust boundary
        │  handle()           lib/server/http.ts      errors → JSON (400/401/403/404/409/429)
        │  requireUser()      lib/server/identity.ts  token hash or session → Identity
        │  loadEvent() / loadManagedEvent() / isPanelJudge()   lib/server/events.ts
        │  readBody(schema)   Zod validation
        ▼
Pure domain logic   lib/{scoring,assignment,bradley-terry,pairing,voting,similarity,phase}.ts
        │           lib/server/results.ts  (the single results engine)
        ▼
Drizzle ─► PostgreSQL
        └─ side effects: audit (lib/server/audit.ts) · signed webhooks (lib/server/webhooks.ts)
```

- **Identity** is established in exactly one place (`identity.ts`): a bearer
  token is hashed and looked up, otherwise the Better Auth session is read.
  Banned users resolve to nobody.
- **Permissions are per event**, not just per role (`events.ts`): you manage an
  event if you created it or are an admin; you judge it if you are on its
  panel; drafts are invisible (404) to everyone else.
- **Handlers are thin.** `handle()` turns thrown `HttpError`/`ZodError` into
  responses, so a route reads as its rules: who may call it, what it validates,
  what it changes, what it audits.

## Where things live

```
apps/juryza/src/
  app/
    (site)/              public: landing, /events, /e/<slug>/… (overview, projects,
                         project, teams, vote, leaderboard, compare), /u/<username>,
                         /certificates, /docs/api, invite pages
    (app)/               signed-in workspace (sidebar shell): dashboard, projects +
                         editor, teams, judging console + pairwise, organizer console
                         /manage/<slug>/…, settings, admin
    (auth)/              login, signup, password reset
    embed/<slug>         iframe-able gallery widget (public/embed.js loads it)
    api/**               the REST API (OpenAPI at /api/openapi.json)
  components/            app shell, editor, shared UI pieces
  lib/
    db/                  schema.ts (whole model), index.ts (pool), seed.ts
    server/              identity, auth, http, events, results, bundle (import/export),
                         exports, voting, webhooks, certificates, audit, rate-limit …
    *.ts                 pure logic, shared by server and client (no framework imports)
    __tests__/           unit tests + API integration tests (bun test)
packages/
  ui/                    the shadcn/ui kit + theme (Base UI)
  config/                shared tsconfig and biome presets
```

**Why the pure/handler split.** The maths — normalization, assignment,
Bradley–Terry, pair selection, quadratic voting, similarity, lifecycle — has no
framework or database imports. It is unit-tested directly, documented in
JUDGING.md, and the same functions run in the API, the CSV export, the
normalization proof and (for the lifecycle) the browser. There is one results
engine (`computeResults`), so every surface shows the same numbers.

**Why the UI uses the REST API.** Pages are client components calling
`/api/**` with TanStack Query. It costs a little server-rendering, and buys the
API-first property for free: anything a person can do in the UI, a script with
a personal API token can do, through the same authorization code.

## Decisions worth defending

- **Multi-event from the root.** One install runs many hackathons, each with its
  own tracks, rubric, panel, voting rules and lifecycle. The seed ships a closed
  fixture event (for the acceptance suite) and an open sandbox event (so the
  whole lifecycle can be tried on first boot).
- **Derived state only.** Phase, ranks, normalized scores, awards and tallies are
  computed on read. Nothing can go stale, and re-weighting a rubric is instant.
- **Import = export = fixtures.** The migration bundle is a superset of the
  fixtures format; the seed imports through the same code path the API uses.
- **Rich text as a document, not HTML.** Safe to render by construction.
- **Simplicity over abstraction.** The scaffold shipped a swappable-auth-provider
  contract, an HTTP client package and a schema-to-form renderer spread across
  five packages; one app with one auth provider needed none of it. Removing them
  took the workspace from seven packages to two and made the auth path readable
  top to bottom.

## Build and deploy

- The Docker image builds with `next build --webpack` (Turbopack's native binary
  can crash in some container CPU environments; the runtime output is the same
  standalone server). Local development uses Turbopack.
- `next.config.ts` pins the workspace root for tracing, sets security headers
  (`X-Frame-Options: DENY` everywhere except `/embed/*`, which allows framing),
  and emits a standalone server.
- The entrypoint waits for Postgres, runs `drizzle-kit push`, seeds (idempotent;
  `SEED_RESET=1` reseeds), copies static assets into the standalone bundle and
  starts it.

## Scaling beyond one box

The only in-process state is the rate-limit map. Move it (and Better Auth's
session cache) to shared storage such as Redis and the app scales horizontally;
Postgres is already external. Webhook delivery is fire-and-forget in-process; a
queue would add retries.
