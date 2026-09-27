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

# --- build: install the full workspace and compile the Next app.
# A single install over the whole repo keeps Bun's workspace hoisting identical
# to local dev, so Turbopack resolves `next` the same way it does on a laptop.
FROM base AS build
COPY . .
RUN bun install --frozen-lockfile || bun install
# Build with the Webpack builder, not Turbopack: Turbopack's native binary
# segfaults (SIGILL/exit 132) inside some container CPU environments after
# compiling successfully. Webpack is slower but rock-solid here, and the runtime
# output (standalone server) is identical. `next.config.ts` pins the workspace
# root so dependency resolution stays correct either way.
RUN cd /repo/apps/juryza && bunx --bun next build --webpack

# --- runtime: everything needed to push schema, seed, and serve
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo ./

WORKDIR /repo/apps/juryza
EXPOSE 8080

COPY apps/juryza/docker-entrypoint.sh /usr/local/bin/juryza-entrypoint.sh
RUN chmod +x /usr/local/bin/juryza-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/juryza-entrypoint.sh"]
