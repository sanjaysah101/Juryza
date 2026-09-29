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
COPY package.json bun.lock ./
COPY apps/juryza/package.json apps/juryza/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/database/package.json packages/database/package.json
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile
COPY . .
# Build with the Webpack builder, not Turbopack: Turbopack's native binary
# segfaults (SIGILL/exit 132) inside some container CPU environments after
# compiling successfully. Webpack is slower but rock-solid here, and the runtime
# output (standalone server) is identical. `next.config.ts` pins the workspace
# root so dependency resolution stays correct either way.
RUN --mount=type=cache,id=next-build-cache,target=/repo/apps/juryza/.next/cache \
	cd /repo/apps/juryza && bunx --bun next build --webpack
RUN cd /repo/apps/juryza && bun build src/lib/db/seed.ts --target=bun --packages=bundle --outfile .next/seed-bundle.js

# --- runtime dependencies: omit compilers, type packages, and other dev tools.
FROM base AS runtime-deps
COPY package.json bun.lock ./
COPY apps/juryza/package.json apps/juryza/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/database/package.json packages/database/package.json
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
	bun install --filter @juryza/database --production --frozen-lockfile --ignore-scripts

# --- runtime: everything needed to push schema, seed, and serve
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo/apps/juryza/.next/standalone/apps/juryza ./apps/juryza
COPY --from=build /repo/apps/juryza/.next/standalone/node_modules ./node_modules
COPY --from=runtime-deps /repo/node_modules/.bun ./node_modules/.bun
COPY --from=build /repo/packages/database/src ./packages/database/src
COPY --from=build /repo/packages/database/drizzle ./packages/database/drizzle
COPY --from=build /repo/packages/database/drizzle.config.ts ./packages/database/drizzle.config.ts
COPY --from=build /repo/packages/database/package.json ./packages/database/package.json
COPY --from=runtime-deps /repo/packages/database/node_modules ./packages/database/node_modules
RUN ln -s ../packages/database/node_modules/drizzle-orm ./node_modules/drizzle-orm \
	&& ln -s ../packages/database/node_modules/pg ./node_modules/pg
RUN mkdir -p ./node_modules/@juryza \
	&& ln -s ../../packages/database ./node_modules/@juryza/database
COPY --from=build /repo/apps/juryza/src ./apps/juryza/src
COPY --from=build /repo/apps/juryza/package.json ./apps/juryza/package.json
COPY --from=build /repo/apps/juryza/tsconfig.json ./apps/juryza/tsconfig.json
COPY --from=build /repo/apps/juryza/.next/static ./apps/juryza/.next/static
COPY --from=build /repo/apps/juryza/.next/seed-bundle.js ./apps/juryza/.next/seed-bundle.js
COPY --from=build /repo/apps/juryza/public ./apps/juryza/public
COPY --from=build /repo/packages/ui ./packages/ui
COPY --from=build /repo/fixtures.json ./fixtures.json

WORKDIR /repo/apps/juryza
EXPOSE 8080

COPY apps/juryza/docker-entrypoint.sh /usr/local/bin/juryza-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/juryza-entrypoint.sh \
	&& chmod +x /usr/local/bin/juryza-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/juryza-entrypoint.sh"]
