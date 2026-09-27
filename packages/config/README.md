<!-- Vendored into this project from notils/create-notils. -->

> **This is your code.** `@juryza/config` lives at `packages/config` in this
> repository — edit it freely. Upstream source and design notes:
> <https://github.com/notils/create-notils>

# @juryza/config

Shared configuration for the juryza monorepo — TypeScript and Biome presets consumed by every app and package. Centralizing them here keeps tooling consistent and lets a single edit propagate everywhere.

## What's inside

| File                  | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `tsconfig.base.json`  | Base TypeScript config — `strict`, `moduleResolution: bundler`, `esnext`, `erasableSyntaxOnly`. Everything extends this. |
| `tsconfig.react.json` | React library preset (`jsx: react-jsx`). For packages like `@juryza/ui`. |
| `tsconfig.nextjs.json`| Next.js app preset (`next` plugin, `jsx: preserve`, `noEmit`). For apps. |
| `biome.json`          | Biome lint + format rules (replaces ESLint + Prettier).                 |

These are exposed via the package `exports` map, so consumers reference them by subpath.

## Usage

**TypeScript** — extend the right preset in a workspace `tsconfig.json`:

```jsonc
// an app
{ "extends": "@juryza/config/tsconfig.nextjs.json" }

// a React library package
{ "extends": "@juryza/config/tsconfig.react.json" }
```

**Biome** — the root `biome.json` extends the shared rules:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.4/schema.json",
  "extends": ["@juryza/config/biome.json"]
}
```

## Conventions

- Avoid `baseUrl` (deprecated in TypeScript 7) — use relative `paths` instead.
- When adding a new preset, add it to the package `exports` map so it can be imported by subpath.
- This package emits no runtime code; it only ships config files.
