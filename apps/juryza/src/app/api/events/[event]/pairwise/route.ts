import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { bradleyTerry } from "@/lib/bradley-terry";
import { assignment, db, pairwiseVote, project, track } from "@/lib/db";
import { id } from "@/lib/ids";
import { nextPair } from "@/lib/pairing";
import { audit } from "@/lib/server/audit";
import { findEvent, isPanelJudge } from "@/lib/server/events";
import { badRequest, forbidden, handle, notFound, readBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";

type P = { event: string };

/**
 * Pairwise judging (Gavel-style, Bradley–Terry).
 *
 * GET  /api/events/:event/pairwise — the next two of the caller's assigned
 *      projects to compare. Pairs are chosen actively (lib/pairing.ts): pairs
 *      this judge has not seen, whose current strengths are closest, so each
 *      answer carries the most information. Plus this judge's progress.
 * POST /api/events/:event/pairwise { winnerId, loserId } — record a verdict.
 *      Both projects must be assigned to the caller.
 */

async function context(ref: string, userId: string) {
  const e = await findEvent(ref);
  if (!e) throw notFound("Event not found");
  if (!(await isPanelJudge(e.id, userId)))
    throw forbidden("You are not on this event's judging panel");
  const assigned = await db
    .select({
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      description: project.description,
      thumbnailUrl: project.thumbnailUrl,
      repoUrl: project.repoUrl,
      liveUrl: project.liveUrl,
      techTags: project.techTags,
      trackName: track.name,
    })
    .from(assignment)
    .innerJoin(project, eq(project.id, assignment.projectId))
    .leftJoin(track, eq(track.id, project.trackId))
    .where(and(eq(assignment.eventId, e.id), eq(assignment.judgeId, userId)));
  return { e, assigned };
}

export const GET = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const { e, assigned } = await context(ref, me.userId);
  const [mine, all] = await Promise.all([
    db
      .select({ winnerId: pairwiseVote.winnerId, loserId: pairwiseVote.loserId })
      .from(pairwiseVote)
      .where(and(eq(pairwiseVote.eventId, e.id), eq(pairwiseVote.judgeId, me.userId))),
    db
      .select({ winnerId: pairwiseVote.winnerId, loserId: pairwiseVote.loserId })
      .from(pairwiseVote)
      .where(eq(pairwiseVote.eventId, e.id)),
  ]);
  const strengths = new Map(bradleyTerry(all).map((b) => [b.projectId, b.strength]));
  const pair = nextPair(
    assigned.map((a) => a.id),
    mine,
    strengths
  );
  const byId = new Map(assigned.map((a) => [a.id, a]));
  const possible = (assigned.length * (assigned.length - 1)) / 2;
  return {
    event: { slug: e.slug, name: e.name },
    pair: pair ? [byId.get(pair[0]), byId.get(pair[1])] : null,
    progress: { compared: mine.length, possible },
  };
});

const body = z.object({ winnerId: z.string().min(1), loserId: z.string().min(1) });

export const POST = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const { e, assigned } = await context(ref, me.userId);
  const { winnerId, loserId } = await readBody(req, body);
  if (winnerId === loserId) throw badRequest("A project cannot beat itself");
  const mine = new Set(assigned.map((a) => a.id));
  if (!mine.has(winnerId) || !mine.has(loserId))
    throw forbidden("Both projects must be assigned to you");
  if (e.resultsPublished) throw forbidden("Results are published; judging is final");

  await db
    .insert(pairwiseVote)
    .values({ id: id.pairwise(), eventId: e.id, judgeId: me.userId, winnerId, loserId });
  await audit({
    eventId: e.id,
    actor: me,
    action: "pairwise.compared",
    target: `${winnerId}>${loserId}`,
    req,
  });
  return { ok: true };
});
