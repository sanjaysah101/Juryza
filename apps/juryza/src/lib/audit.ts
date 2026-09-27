import type { Identity } from "@/lib/api-auth";
import { auditLog, db } from "@/lib/db";
import { id } from "@/lib/ids";

/**
 * Append a row to the audit trail.
 *
 * "An audit trail an organizer can read without a database client" (spec, T2/T3).
 * Every consequential action — a score written, an assignment made, a CSV
 * exported, a vote cast, a role changed — records one human-readable row. The
 * organizer reads them at `/api/organizer/audit` and in the dashboard.
 *
 * Deliberately fire-and-forget: an audit write must never fail the action it is
 * recording. Errors are swallowed (logged to the server console) so a full disk
 * or a transient DB hiccup cannot, say, block a judge from saving a score.
 */
export async function audit(entry: {
  eventId?: string | null;
  actor?: Identity | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: id.audit(),
      eventId: entry.eventId ?? null,
      actorId: entry.actor?.userId ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log entry", entry.action, err);
  }
}
