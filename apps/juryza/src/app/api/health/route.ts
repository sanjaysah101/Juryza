import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { HttpError, handle } from "@/lib/server/http";

/**
 * GET /api/health — liveness and database readiness, for container
 * healthchecks and uptime monitors. 200 `{ ok: true }`, or 503 when the
 * database is unreachable.
 */
export const GET = handle(async () => {
  try {
    await db.execute(sql`select 1`);
  } catch {
    throw new HttpError(503, "Database unavailable");
  }
  return { ok: true, time: new Date().toISOString() };
});
