import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { db, track } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * Public list of tracks for the active event (T1) — powers the gallery's track
 * filter and the submission form's track picker.
 */
export async function GET() {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ tracks: [] });
  const rows = await db
    .select({ id: track.id, name: track.name })
    .from(track)
    .where(eq(track.eventId, activeEvent.id));
  return NextResponse.json({ tracks: rows });
}
