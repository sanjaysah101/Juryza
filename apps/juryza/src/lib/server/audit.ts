import { auditLog, db } from "@/lib/db";
import { id } from "@/lib/ids";
import type { Identity } from "@/lib/server/identity";

/**
 * Append a row to the audit trail.
 *
 * Every consequential action — a score saved, assignments generated, an export
 * downloaded, a vote cast, a role changed, a denied cross-judge read — records
 * one human-readable row that organizers read in the dashboard.
 *
 * Deliberately never throws: an audit write must not fail the action it records.
 */
export async function audit(entry: {
  eventId?: string | null;
  actor?: Identity | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
  req?: Request;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: id.audit(),
      eventId: entry.eventId ?? null,
      actorId: entry.actor?.userId ?? null,
      actorName: entry.actor?.name ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
      ipAddress: entry.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log entry", entry.action, err);
  }
}
