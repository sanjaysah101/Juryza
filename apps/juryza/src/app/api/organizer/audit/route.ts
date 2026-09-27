import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";

import { isResponse, requireRole } from "@/lib/api-auth";
import { auditLog, db } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * The audit trail (T2/T3) — "an audit trail an organizer can read without a
 * database client." Organizer/admin only. Returns the most recent entries for
 * the active event, newest first, in a plain readable shape.
 */
export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 1000);

  const rows = await db
    .select({
      id: auditLog.id,
      actorRole: auditLog.actorRole,
      actorId: auditLog.actorId,
      action: auditLog.action,
      target: auditLog.target,
      detail: auditLog.detail,
      ipAddress: auditLog.ipAddress,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(activeEvent ? eq(auditLog.eventId, activeEvent.id) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return NextResponse.json({ entries: rows });
}
