import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { forbidden, isResponse, requireRole, resolveIdentity, unauthorized } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { assignment, db, pairwiseVote, project } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id } from "@/lib/ids";
import { seededShuffle } from "@/lib/voting";

/**
 * Pairwise judging (T2 bonus).
 *
 * `GET` returns two of the calling judge's assigned projects to compare — a
 * random pair, so ordering carries no signal. Role-isolated exactly like the
 * scores endpoint: a judge only ever compares their own assigned projects.
 *
 * `POST { winnerId, loserId }` records one comparison (append-only). The global
 * ranking is recovered by the Bradley–Terry estimator at `/api/results/pairwise`.
 */

export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return unauthorized();
  if (identity.role !== "judge") return forbidden("Only judges compare projects");

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ pair: null });

  const assigned = await db
    .select({
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      summary: project.summary,
    })
    .from(assignment)
    .innerJoin(project, eq(project.id, assignment.projectId))
    .where(and(eq(assignment.eventId, activeEvent.id), eq(assignment.judgeId, identity.userId)));

  if (assigned.length < 2)
    return NextResponse.json({ pair: null, reason: "Need at least two assigned projects" });

  // Random pair, seeded per-judge-per-minute so refreshes vary.
  const seed = `${identity.userId}:${Math.floor(Date.now() / 60000)}`;
  const shuffled = seededShuffle(assigned, seed);
  return NextResponse.json({ pair: [shuffled[0], shuffled[1]] });
}

const voteSchema = z.object({ winnerId: z.string().min(1), loserId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { exact: "judge" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = voteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { winnerId, loserId } = parsed.data;
  if (winnerId === loserId) {
    return NextResponse.json({ error: "A project cannot beat itself" }, { status: 400 });
  }

  // Isolation: both projects must be assigned to this judge.
  const mine = await db
    .select({ projectId: assignment.projectId })
    .from(assignment)
    .where(and(eq(assignment.eventId, activeEvent.id), eq(assignment.judgeId, identity.userId)));
  const mineSet = new Set(mine.map((m) => m.projectId));
  if (!mineSet.has(winnerId) || !mineSet.has(loserId)) {
    return forbidden("Both projects must be assigned to you");
  }

  await db.insert(pairwiseVote).values({
    id: id.pairwise(),
    eventId: activeEvent.id,
    judgeId: identity.userId,
    winnerId,
    loserId,
  });

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "pairwise.compared",
    target: `${winnerId}>${loserId}`,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
}
