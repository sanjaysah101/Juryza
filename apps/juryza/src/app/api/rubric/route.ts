import { NextResponse } from "next/server";

import { asc, eq } from "drizzle-orm";

import { db, rubricCriterion } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * The active event's weighted rubric (T2). Public so the judge console and the
 * gallery can render criteria and weights consistently. Ordered by position.
 */
export async function GET() {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ criteria: [] });
  const rows = await db
    .select({
      key: rubricCriterion.key,
      label: rubricCriterion.label,
      description: rubricCriterion.description,
      weight: rubricCriterion.weight,
    })
    .from(rubricCriterion)
    .where(eq(rubricCriterion.eventId, activeEvent.id))
    .orderBy(asc(rubricCriterion.position));
  return NextResponse.json({ criteria: rows });
}
