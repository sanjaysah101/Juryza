#!/bin/sh
# Container entrypoint: bring the portal up, seeded, in one shot.
#
#   1. wait for Postgres to accept connections
#   2. push the Drizzle schema (creates tables)
#   3. seed from fixtures.json (writes .dogfood.toml to the repo root)
#   4. start the standalone Next server on :8080
#
# Everything is offline — no network beyond the compose-internal db service.
set -e

echo "[entrypoint] waiting for postgres at ${DATABASE_URL:-<unset>} ..."
tries=0
until bun -e "const{Client}=require('pg');const c=new Client(process.env.DATABASE_URL);c.connect().then(()=>{c.end();process.exit(0)}).catch(()=>process.exit(1))" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "[entrypoint] postgres did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] postgres is ready"

echo "[entrypoint] applying pending database migrations ..."
bun run /repo/packages/database/src/migrate.ts

echo "[entrypoint] seeding from fixtures.json ..."
bun /repo/apps/juryza/.next/seed-bundle.js

APP_DIR=/repo/apps/juryza
echo "[entrypoint] starting portal on :8080 ..."
# Run the standalone server produced by `next build` (output: "standalone").
exec bun "$APP_DIR/server.js"
