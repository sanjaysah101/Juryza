import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, event } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { dispatch } from "@/lib/webhooks";

/**
 * Toggle result publication (T3). Organizer/admin only. Until this is on,
 * `/api/results` hides numbers from everyone but organizers — the "results
 * hidden until the window closes" rule, made an explicit, audited action.
 */
const bodySchema = z.object({ published: z.boolean() });

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await db
    .update(event)
    .set({ resultsPublished: parsed.data.published })
    .where(eq(event.id, activeEvent.id));

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: parsed.data.published ? "results.published" : "results.unpublished",
    ipAddress: req.headers.get("x-forwarded-for"),
  });
  if (parsed.data.published) {
    void dispatch(
      "results.published",
      { eventId: activeEvent.id, name: activeEvent.name },
      activeEvent.id
    );
  }

  return NextResponse.json({ published: parsed.data.published });
}
