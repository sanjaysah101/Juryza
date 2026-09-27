# ARCHITECTURE.md — the shape of the system, and why

## One-paragraph overview

Juryza is a single Next.js 16 (App Router) application backed by PostgreSQL 18
via Drizzle ORM, with Better Auth for identity. It ships as one container plus a
database container; `docker compose up` pushes the schema, seeds from
`fixtures.json`, writes `.dogfood.toml`, and serves on `:8080`. The frontend and
the API are the same app — API routes under `src/app/api/**`, pages elsewhere —
and **all authorization is enforced in the API layer**, never the UI.

## Stack & why

| Choice | Why |
| --- | --- |
| **Next.js 16 (App Router)** | One codebase for the API and the console/gallery; RSC + route handlers; no separate backend to deploy. |
| **PostgreSQL 18 + Drizzle** | Runs entirely in a local container (satisfies "no hosted DB"); Drizzle gives a typed schema in one file with first-class Better Auth support. |
| **Better Auth + `admin` plugin** | Self-hostable auth (no auth-as-a-service); the admin plugin provides the five-role model and backend role helpers. |
| **Bun + Turborepo** | Fast installs/builds; the repo is a small monorepo (shared `ui`, `auth-*`, `form-builder` packages) scaffolded by create-notils. |
| **TanStack Query** | All client data fetching — caching, invalidation, loading states — without hand-rolled state. |
| **Bearer tokens for the API** | The acceptance checker attaches a static header; bearer tokens make role isolation a pure backend decision and double as the T4 programmatic credential. |

## Request lifecycle & the trust boundary

```
Browser / curl / acceptance-suite
        │  Authorization: Bearer <token>   (or Better Auth session cookie)
        ▼
Next.js route handler  (src/app/api/**)
        │  resolveIdentity(req)  ── lib/api-auth.ts ──► { userId, role }
        │  requireRole(req, { min|exact })   → 401 / 403 on failure
        ▼
Domain logic (pure): scoring.ts · assignment.ts · bradley-terry.ts · voting.ts
        ▼
Drizzle  ──►  PostgreSQL
        │
        └── side effects: audit.ts (audit_log), webhooks.ts (signed POST)
```

`lib/api-auth.ts` is the single place identity is established and roles are
checked. Every protected route derives authorization from it, so "hide the
button" is never mistaken for "refuse the request". This is the property the
acceptance suite verifies with a curl and the reason Judging Integrity holds.

## Where the logic lives

- **`src/lib/db/`** — `schema.ts` (the whole model in one file), `index.ts` (the
  pooled client, pinned to `globalThis` for Next's per-module re-instantiation),
  `seed.ts` (loads fixtures, mints test tokens, writes `.dogfood.toml`).
- **`src/lib/api-auth.ts`** — identity resolution + role guards (the boundary).
- **`src/lib/scoring.ts`** — weighted raw score + z-score normalization. Pure,
  no framework imports, unit-testable.
- **`src/lib/assignment.ts`** — round-robin & batch strategies. Pure.
- **`src/lib/bradley-terry.ts`** — pairwise ranking estimator. Pure.
- **`src/lib/voting.ts`** — quadratic tally, seeded ballot shuffle. Pure.
- **`src/lib/{audit,webhooks,signing,rate-limit}.ts`** — cross-cutting concerns.
- **`src/app/api/**`** — thin HTTP handlers that authenticate, validate (Zod),
  call the pure logic, and write via Drizzle.
- **`src/app/**` (pages)** — the gallery, dashboards, judge console, voting — all
  client components using TanStack Query against the same API.

**Why the pure/handler split:** the judging maths (`scoring`, `assignment`,
`bradley-terry`, `voting`) has zero framework dependencies, so it is trivially
testable and defensible in writing (JUDGING.md). The handlers own auth,
validation and persistence; the maths owns the numbers.

## Monorepo layout

```
apps/juryza/            the portal (this is the product)
  src/app/              routes (pages + api)
  src/lib/              db, auth, domain logic
  Dockerfile            multi-stage: bun install → next build → runtime
  docker-entrypoint.sh  wait-for-db → db push → seed → serve
packages/
  ui/                   shared shadcn/ui kit (Base UI)
  auth-core, auth-better-auth, auth-ui   the auth contract + Better Auth provider + forms
  form-builder          Zod-schema → form renderer
  api-client, config    HTTP transport core, shared tsconfig/biome
docker-compose.yml      db (postgres:18) + portal
run.py, fixtures.json   the acceptance suite and shared data (from the organizers)
```

The platform logic lives in `apps/juryza`, not scattered across packages: it is
one product with one consumer, so extra package boundaries would add wiring
friction without reuse. The shared packages are the genuinely reusable seams
(UI kit, auth contract) the scaffold already provides.

## Build & deploy notes

- **Production build uses the Webpack builder** (`next build --webpack`), not
  Turbopack: Turbopack's native binary segfaults inside some container CPU
  environments *after* compiling successfully. Webpack is slower but reliable and
  the runtime output (a standalone server) is identical. Dev on a host uses
  Turbopack normally.
- `next.config.ts` pins `turbopack.root` and `outputFileTracingRoot` to the repo
  root so monorepo dependency resolution is deterministic in Docker.
- The entrypoint copies `.next/static` and `public` into the standalone bundle
  before starting `server.js` (Next omits them from `output: "standalone"`).

## Scaling beyond one container

- Move the rate-limiter and session store to Better Auth's `secondaryStorage`
  (Redis) — the code already isolates it behind `lib/rate-limit.ts`.
- Postgres is already external to the app process, so the portal scales
  horizontally; the only in-process state is the rate-limit map.
