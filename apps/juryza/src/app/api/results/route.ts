import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { hasAtLeast, resolveIdentity } from "@/lib/api-auth";
import { db, project, rubricCriterion, score, vote } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { aggregateByProject, normalizeScores, toScoreRows } from "@/lib/scoring";
import { tallyQuadratic } from "@/lib/voting";

/**
 * Public results (T3) — with the hidden-until-published rule.
 *
 * Results are withheld from everyone but organizers/admins until an organizer
 * flips `resultsPublished`. Before then a non-organizer gets `published: false`
 * and no numbers, so the voting window cannot be reverse-engineered from a
 * public endpoint. Organizers can always see them (for the live dashboard).
 *
 * When public, this returns the normalized judge ranking and the quadratic vote
 * tally side by side.
 */
export async function GET(req: NextRequest) {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ published: false, results: [] });

  const identity = await resolveIdentity(req);
  const isOrganizer = identity ? hasAtLeast(identity.role, "organizer") : false;

  if (!activeEvent.resultsPublished && !isOrganizer) {
    return NextResponse.json({ published: false, results: [] });
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
  const judged = aggregateByProject(normalized);

  const votes = await db
    .select({ projectId: vote.projectId, voterKey: vote.voterKey, credits: vote.credits })
    .from(vote)
    .where(eq(vote.eventId, activeEvent.id));
  const voteTally = new Map(tallyQuadratic(votes).map((t) => [t.projectId, t]));

  const projects = await db
    .select({ id: project.id, title: project.title })
    .from(project)
    .where(eq(project.eventId, activeEvent.id));
  const titleById = new Map(projects.map((p) => [p.id, p.title]));

  const results = judged.map((r, i) => ({
    projectId: r.projectId,
    title: titleById.get(r.projectId) ?? r.projectId,
    rank: i + 1,
    reviews: r.reviews,
    normalizedMean: r.normalizedMean,
    voteInfluence: voteTally.get(r.projectId)?.influence ?? 0,
    voters: voteTally.get(r.projectId)?.voters ?? 0,
  }));

  return NextResponse.json({
    published: activeEvent.resultsPublished,
    previewForOrganizer: !activeEvent.resultsPublished && isOrganizer,
    results,
  });
}
