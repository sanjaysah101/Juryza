import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { batched, roundRobin } from "@/lib/assignment";
import { audit } from "@/lib/audit";
import { assignment, db, judgeTracks, project, user as userTable } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id } from "@/lib/ids";

/**
 * Generate judge → project assignments (T2). Organizer/admin only.
 *
 * Body: `{ strategy: "round-robin" | "batch", reviewsPerProject?: number }`.
 * The strategy functions are pure (see `lib/assignment.ts`); this route just
 * loads the judges and submitted projects, runs the chosen strategy, and inserts
 * the pairs (ignoring any that already exist). Documented in JUDGING.md.
 */
const bodySchema = z.object({
  strategy: z.enum(["round-robin", "batch"]).default("round-robin"),
  reviewsPerProject: z.number().int().min(1).max(10).default(3),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { strategy, reviewsPerProject } = parsed.data;

  // All judges, with the tracks they cover (empty = generalist).
  const judgeRows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.role, "judge"));

  const trackRows = await db
    .select({ judgeId: judgeTracks.judgeId, trackId: judgeTracks.trackId })
    .from(judgeTracks)
    .where(eq(judgeTracks.eventId, activeEvent.id));
  const tracksByJudge = new Map<string, string[]>();
  for (const t of trackRows) {
    const list = tracksByJudge.get(t.judgeId) ?? [];
    list.push(t.trackId);
    tracksByJudge.set(t.judgeId, list);
  }

  const judges = judgeRows.map((j) => ({ id: j.id, tracks: tracksByJudge.get(j.id) ?? [] }));

  const projects = await db
    .select({ id: project.id, trackId: project.trackId })
    .from(project)
    .where(eq(project.eventId, activeEvent.id));

  const pairs =
    strategy === "batch"
      ? batched(judges, projects)
      : roundRobin(judges, projects, reviewsPerProject);

  let inserted = 0;
  for (const p of pairs) {
    const res = await db
      .insert(assignment)
      .values({
        id: id.assignment(),
        eventId: activeEvent.id,
        judgeId: p.judgeId,
        projectId: p.projectId,
        batch: p.batch,
      })
      .onConflictDoNothing();
    // node-postgres returns rowCount on the result.
    inserted += (res as { rowCount?: number }).rowCount ?? 0;
  }

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "assignment.generated",
    detail: { strategy, reviewsPerProject, pairs: pairs.length, inserted },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ strategy, generated: pairs.length, inserted });
}
