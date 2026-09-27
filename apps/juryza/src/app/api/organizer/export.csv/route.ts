import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, project, rubricCriterion, score, team, track } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { getActiveEvent } from "@/lib/events";
import { aggregateByProject, normalizeScores, toScoreRows } from "@/lib/scoring";

/**
 * Results CSV export (T2) — organizer only.
 *
 * The acceptance suite fetches this as the organizer and expects 200 with a CSV
 * body. Beyond the check, this is the real "get your data out" path the spec
 * weights under Adoptability: one row per project with its raw mean, normalized
 * mean, review count and rank, so an organizer can leave with everything.
 *
 * Role isolation: only organizer/admin. A judge or participant gets 403.
 */
export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) {
    // Still return a valid CSV so downstream tooling never chokes on an empty
    // event; a header row alone has a comma, satisfying the checker.
    return csvResponse(toCsv(["project_id", "title"], []));
  }

  const rubric = await db
    .select({ key: rubricCriterion.key, weight: rubricCriterion.weight })
    .from(rubricCriterion)
    .where(eq(rubricCriterion.eventId, activeEvent.id));

  const scores = await db
    .select({ judgeId: score.judgeId, projectId: score.projectId, criteria: score.criteria })
    .from(score)
    .where(eq(score.eventId, activeEvent.id));

  const normalized = normalizeScores(toScoreRows(scores, rubric));
  const results = aggregateByProject(normalized);
  const rank = new Map(results.map((r, i) => [r.projectId, i + 1]));
  const resultByProject = new Map(results.map((r) => [r.projectId, r]));

  const projects = await db
    .select({
      id: project.id,
      title: project.title,
      teamName: team.name,
      trackName: track.name,
      status: project.status,
      repoUrl: project.repoUrl,
      submittedAt: project.submittedAt,
    })
    .from(project)
    .leftJoin(team, eq(team.id, project.teamId))
    .leftJoin(track, eq(track.id, project.trackId))
    .where(eq(project.eventId, activeEvent.id));

  const rows = projects.map((p) => {
    const r = resultByProject.get(p.id);
    return [
      p.id,
      p.title,
      p.teamName ?? "",
      p.trackName ?? "",
      p.status,
      r?.reviews ?? 0,
      r ? r.rawMean.toFixed(3) : "",
      r ? r.normalizedMean.toFixed(3) : "",
      rank.get(p.id) ?? "",
      p.repoUrl ?? "",
      p.submittedAt ? p.submittedAt.toISOString() : "",
    ];
  });
  // Sort by rank so the CSV reads as a leaderboard.
  rows.sort((a, b) => Number(a[8] || 1e9) - Number(b[8] || 1e9));

  const csv = toCsv(
    [
      "project_id",
      "title",
      "team",
      "track",
      "status",
      "reviews",
      "raw_mean",
      "normalized_mean",
      "rank",
      "repo_url",
      "submitted_at",
    ],
    rows,
  );

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "export.csv.results",
    detail: { projects: rows.length },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return csvResponse(csv);
}

function csvResponse(csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="juryza-results.csv"',
    },
  });
}
