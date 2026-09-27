# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Juryza portal image.
#
# A single Bun image that installs the whole monorepo, builds the Next app, and
# at container start pushes the Drizzle schema, seeds from fixtures.json, and
# serves on :8080. Kept intentionally simple — one command to running is worth
# more here than a perfectly minimal image, and the whole thing must come up
# offline with the network off.
# ---------------------------------------------------------------------------

FROM oven/bun:1.3.14 AS base
WORKDIR /repo

# --- deps: install the full workspace (dev deps needed for build + drizzle-kit)
FROM base AS deps
COPY package.json bun.lock* ./
COPY turbo.json biome.json ./
COPY packages ./packages
COPY apps/juryza/package.json ./apps/juryza/package.json
RUN bun install --frozen-lockfile || bun install

# --- build: compile the Next app to a standalone server bundle
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
WORKDIR /repo/apps/juryza
RUN bun run build

# --- runtime: everything needed to push schema, seed, and serve
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Full install so drizzle-kit and the seed's tsx-style bun execution work.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo ./

WORKDIR /repo/apps/juryza
EXPOSE 8080

# The entrypoint waits for Postgres, pushes the schema, seeds, then starts the
# standalone server. It writes .dogfood.toml back to the repo root (mounted).
COPY apps/juryza/docker-entrypoint.sh /usr/local/bin/juryza-entrypoint.sh
RUN chmod +x /usr/local/bin/juryza-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/juryza-entrypoint.sh"]
