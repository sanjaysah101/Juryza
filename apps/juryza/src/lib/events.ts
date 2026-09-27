import { desc } from "drizzle-orm";

import type { Event } from "@/lib/db";
import { db, event } from "@/lib/db";

/**
 * The "active" event.
 *
 * A full platform hosts many events; the acceptance checker and the seeded
 * fixture assume a single current one. This returns the most recently created
 * event, which in a freshly seeded portal is the fixture event. Routes that are
 * event-scoped call this when no explicit event id is supplied.
 */
export async function getActiveEvent(): Promise<Event | null> {
  const rows = await db.select().from(event).orderBy(desc(event.createdAt)).limit(1);
  return rows[0] ?? null;
}

/** Submissions are open iff now is within [open, close). */
export function submissionsOpen(e: Pick<Event, "submissionsOpen" | "submissionsClose">): boolean {
  const now = Date.now();
  const opensOk = !e.submissionsOpen || now >= e.submissionsOpen.getTime();
  const closesOk = now < e.submissionsClose.getTime();
  return opensOk && closesOk;
}
