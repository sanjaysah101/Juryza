# juryza

A production-ready Next.js project scaffolded with create-notils — Bun + Tailwind v4 +
shadcn/ui on Base UI + Biome + Turborepo. Every file is yours to edit.

## Getting started

```sh
bun install
bun dev
```

Open http://localhost:3000.

## Quality gate

```sh
bun lint
bun typecheck
bun build
```

## What's included

- `api-client` — Platform-neutral HTTP transport core (createHttpClient, HttpError)
- `ui` — shadcn/ui component kit on Base UI, with the Tailwind v4 theme
- `form-builder` — Recursive Zod-schema-to-form renderer
- `auth-core` — The provider-agnostic auth contract (types only)
- `auth-better-auth` — Auth provider backed by Better Auth, plus its server-side session helpers
- `auth-ui` — SignInForm, SignUpForm, ForgotPasswordForm, SessionStatus, ProtectedRoute

This is a fresh app — no example pages or demo flows. Add capabilities as you need them.

## Structure

- `apps/*` — your Next.js app(s)
- `packages/ui` — the shared shadcn/ui kit (Base UI); import from `@juryza/ui/...`
- `packages/config` — shared TypeScript + Biome config

Add or update UI components from `packages/ui`:

```sh
cd packages/ui
bun run ui:add button
```

## Environments

One environment, configured in `.env.local`. `.env.example` is **the only
committed env file** — the reference list of every variable this project reads,
with no real values; every other `.env*` file is gitignored.

Read the active environment from one place:

```ts
import { environment, isProduction } from "@juryza/config/env";
```

Resolution lives in `packages/config/env.ts`. To add development/staging/production later,
change that one file and add the matching `.env.<name>` files — nothing that
imports `environment` needs to change.

## Adding capabilities

```sh
bun run notils list           # what's available, what's installed
bun run notils add auth-ui    # add a capability to this project
```

```sh
bun run notils add app admin  # add another app under apps/
```

This runs [`@notils/cli`](https://www.npmjs.com/package/@notils/cli), installed here
as a devDependency so this project has its own copy. Everything it writes is your
source; delete the directory to remove a capability.

It was installed at `latest`, so your lockfile pinned whichever version was current
when you installed. To pick up newer CLI releases:

```sh
bun update @notils/cli
```

## AI agent context

This project ships the `notils-project` skill (`.agents/skills/notils-project/`) —
its specification: architecture, layout, rules, and patterns. AI coding agents read
it automatically.

Skills for the libraries in this stack are maintained by their own authors. Install
them with the [`skills`](https://www.npmjs.com/package/skills) CLI:

```sh
bunx skills add shadcn-ui/ui   # shadcn/ui component + composition rules
bunx skills find <query>       # search for more
bunx skills list               # what's installed
```

See `AGENTS.md` for architecture, conventions, and setup notes (also read by AI coding agents).

---

_Generated with [create-notils](https://github.com/notils/create-notils) v0.7.0._
