import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, sql } from "drizzle-orm";

import { isResponse, requireRole } from "@/lib/api-auth";
import { assignment, db, project, rubricCriterion, score, user as userTable } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { aggregateByProject, normalizeScores, toScoreRows } from "@/lib/scoring";

/**
 * Organizer dashboard data (T2): totals, per-judge progress (so an organizer can
 * see who has not started), and normalized results. Organizer/admin only.
 */
export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) {
    return NextResponse.json({
      totals: { projects: 0, judges: 0, assignments: 0, scores: 0 },
      progress: [],
      results: [],
    });
  }
  const eventId = activeEvent.id;

  // Per-judge assigned/scored counts, joined to the judge's name.
  const assignedCounts = await db
    .select({ judgeId: assignment.judgeId, assigned: sql<number>`count(*)::int` })
    .from(assignment)
    .where(eq(assignment.eventId, eventId))
    .groupBy(assignment.judgeId);

  const scoredCounts = await db
    .select({ judgeId: score.judgeId, scored: sql<number>`count(*)::int` })
    .from(score)
    .where(eq(score.eventId, eventId))
    .groupBy(score.judgeId);

  const scoredByJudge = new Map(scoredCounts.map((r) => [r.judgeId, r.scored]));

  const judgeIds = assignedCounts.map((r) => r.judgeId);
  const names = judgeIds.length
    ? await db
        .select({ id: userTable.id, name: userTable.name })
        .from(userTable)
        .where(sql`${userTable.id} in ${judgeIds}`)
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  const progress = assignedCounts
    .map((r) => ({
      judgeId: r.judgeId,
      name: nameById.get(r.judgeId) ?? r.judgeId,
      assigned: r.assigned,
      scored: scoredByJudge.get(r.judgeId) ?? 0,
    }))
    .sort((a, b) => a.scored / a.assigned - b.scored / b.assigned);

  // Normalized results.
  const rubric = await db
    .select({ key: rubricCriterion.key, weight: rubricCriterion.weight })
    .from(rubricCriterion)
    .where(eq(rubricCriterion.eventId, eventId));
  const scores = await db
    .select({ judgeId: score.judgeId, projectId: score.projectId, criteria: score.criteria })
    .from(score)
    .where(eq(score.eventId, eventId));
  const normalized = normalizeScores(toScoreRows(scores, rubric));
  const agg = aggregateByProject(normalized);

  const projects = await db
    .select({ id: project.id, title: project.title })
    .from(project)
    .where(eq(project.eventId, eventId));
  const titleById = new Map(projects.map((p) => [p.id, p.title]));

  const results = agg.map((r, i) => ({
    projectId: r.projectId,
    title: titleById.get(r.projectId) ?? r.projectId,
    reviews: r.reviews,
    rawMean: r.rawMean,
    normalizedMean: r.normalizedMean,
    rank: i + 1,
  }));

  const projectCountRows = await db
    .select({ projectCount: sql<number>`count(*)::int` })
    .from(project)
    .where(and(eq(project.eventId, eventId), eq(project.status, "submitted")));
  const projectCount = projectCountRows[0]?.projectCount;

  return NextResponse.json({
    totals: {
      projects: projectCount ?? projects.length,
      judges: progress.length,
      assignments: assignedCounts.reduce((a, b) => a + b.assigned, 0),
      scores: scores.length,
    },
    progress,
    results,
  });
}
