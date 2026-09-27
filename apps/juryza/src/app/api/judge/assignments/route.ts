import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";

import { forbidden, resolveIdentity, unauthorized } from "@/lib/api-auth";
import { assignment, db, project, score, track } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * The projects assigned to the calling judge (T2).
 *
 * Role isolation: a judge sees ONLY their own assignments — the query is scoped
 * to `assignment.judgeId = caller`. There is no parameter to view another
 * judge's queue. Each row carries whether this judge has already scored it, so
 * the judge console can show progress.
 */
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return unauthorized();
  if (identity.role !== "judge") return forbidden("Only judges have assignments");

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ assignments: [] });

  const rows = await db
    .select({
      projectId: project.id,
      title: project.title,
      tagline: project.tagline,
      summary: project.summary,
      repoUrl: project.repoUrl,
      liveUrl: project.liveUrl,
      videoUrl: project.videoUrl,
      trackName: track.name,
      batch: assignment.batch,
      scoreId: score.id,
      criteria: score.criteria,
      comment: score.comment,
    })
    .from(assignment)
    .innerJoin(project, eq(project.id, assignment.projectId))
    .leftJoin(track, eq(track.id, project.trackId))
    .leftJoin(
      score,
      and(eq(score.projectId, assignment.projectId), eq(score.judgeId, assignment.judgeId))
    )
    .where(and(eq(assignment.eventId, activeEvent.id), eq(assignment.judgeId, identity.userId)));

  const assignments = rows.map((r) => ({
    projectId: r.projectId,
    title: r.title,
    tagline: r.tagline,
    summary: r.summary,
    repoUrl: r.repoUrl,
    liveUrl: r.liveUrl,
    videoUrl: r.videoUrl,
    trackName: r.trackName,
    batch: r.batch,
    scored: r.scoreId !== null,
    criteria: r.criteria ?? null,
    comment: r.comment ?? null,
  }));

  return NextResponse.json({
    judgeId: identity.userId,
    total: assignments.length,
    scored: assignments.filter((a) => a.scored).length,
    assignments,
  });
}
