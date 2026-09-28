import { and, desc, eq, ilike, lt } from "drizzle-orm";

import { auditLog, db } from "@/lib/db";
import { loadManagedEvent } from "@/lib/server/events";
import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";

/**
 * GET /api/events/:event/audit — the event's audit trail, newest first
 * (organizers). `?action=score` filters by action prefix, `?before=<iso>`
 * pages backwards, `?limit=` caps the page (max 200).
 */
export const GET = handle<{ event: string }>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const url = new URL(req.url);
  const action = url.searchParams.get("action")?.trim();
  const before = url.searchParams.get("before");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const entries = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.eventId, e.id),
        action ? ilike(auditLog.action, `${action}%`) : undefined,
        before ? lt(auditLog.createdAt, new Date(before)) : undefined
      )
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return { entries, nextBefore: entries.length === limit ? entries.at(-1)?.createdAt : null };
});
