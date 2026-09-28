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

echo "[entrypoint] pushing schema ..."
bunx --bun drizzle-kit push --force

echo "[entrypoint] seeding from fixtures.json ..."
bun run src/lib/db/seed.ts

# The standalone bundle does not include static assets or the public folder —
# Next expects them copied next to server.js. Do it here so CSS/JS chunks and
# public files are served (otherwise the pages load unstyled with 404s).
STANDALONE=/repo/apps/juryza/.next/standalone/apps/juryza
mkdir -p "$STANDALONE/.next"
cp -r /repo/apps/juryza/.next/static "$STANDALONE/.next/static"
if [ -d /repo/apps/juryza/public ]; then
  cp -r /repo/apps/juryza/public "$STANDALONE/public"
fi

echo "[entrypoint] starting portal on :8080 ..."
# Run the standalone server produced by `next build` (output: "standalone").
exec bun "$STANDALONE/server.js"
