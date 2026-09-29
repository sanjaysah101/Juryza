import { and, desc, eq } from "drizzle-orm";
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
 *      projects to compare, along with matchup intensity, recent verdicts, and progress.
 * POST /api/events/:event/pairwise { winnerId, loserId } — record a verdict.
 * DELETE /api/events/:event/pairwise — undo the caller's most recent verdict.
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
      content: project.content,
      videoUrl: project.videoUrl,
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
  const skip = req.nextUrl.searchParams.get("skip");
  const skipPairs = skip
    ? skip.split(",").map((s) => {
        const [w, l] = s.split("|");
        return { winnerId: w ?? "", loserId: l ?? "" };
      })
    : [];

  const [mine, all] = await Promise.all([
    db
      .select({
        id: pairwiseVote.id,
        winnerId: pairwiseVote.winnerId,
        loserId: pairwiseVote.loserId,
        createdAt: pairwiseVote.createdAt,
      })
      .from(pairwiseVote)
      .where(and(eq(pairwiseVote.eventId, e.id), eq(pairwiseVote.judgeId, me.userId)))
      .orderBy(desc(pairwiseVote.createdAt)),
    db
      .select({ winnerId: pairwiseVote.winnerId, loserId: pairwiseVote.loserId })
      .from(pairwiseVote)
      .where(eq(pairwiseVote.eventId, e.id)),
  ]);
  const strengths = new Map(bradleyTerry(all).map((b) => [b.projectId, b.strength]));
  const pair = nextPair(
    assigned.map((a) => a.id),
    [...mine, ...skipPairs],
    strengths
  );
  const byId = new Map(assigned.map((a) => [a.id, a]));
  const possible = (assigned.length * (assigned.length - 1)) / 2;

  let matchup = null;
  if (pair) {
    const sA = strengths.get(pair[0]) ?? 1;
    const sB = strengths.get(pair[1]) ?? 1;
    const gap = Math.abs(Math.log(sA) - Math.log(sB));
    matchup = {
      gap,
      isClose: gap < 0.35,
      informationGain: gap < 0.35 ? "High" : gap < 0.8 ? "Medium" : "Standard",
    };
  }

  const recent = mine.slice(0, 5).map((m) => {
    const w = byId.get(m.winnerId);
    const l = byId.get(m.loserId);
    return {
      id: m.id,
      winnerId: m.winnerId,
      winnerTitle: w?.title ?? "Project",
      winnerThumb: w?.thumbnailUrl ?? null,
      loserId: m.loserId,
      loserTitle: l?.title ?? "Project",
      loserThumb: l?.thumbnailUrl ?? null,
      createdAt: m.createdAt,
    };
  });

  return {
    event: { slug: e.slug, name: e.name },
    pair: pair ? [byId.get(pair[0]), byId.get(pair[1])] : null,
    matchup,
    recent,
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

export const DELETE = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const { e } = await context(ref, me.userId);
  if (e.resultsPublished) throw forbidden("Results are published; judging is final");

  const [lastVote] = await db
    .select({
      id: pairwiseVote.id,
      winnerId: pairwiseVote.winnerId,
      loserId: pairwiseVote.loserId,
    })
    .from(pairwiseVote)
    .where(and(eq(pairwiseVote.eventId, e.id), eq(pairwiseVote.judgeId, me.userId)))
    .orderBy(desc(pairwiseVote.createdAt))
    .limit(1);

  if (!lastVote) throw badRequest("No recent comparison to undo");

  await db.delete(pairwiseVote).where(eq(pairwiseVote.id, lastVote.id));
  await audit({
    eventId: e.id,
    actor: me,
    action: "pairwise.undone",
    target: `${lastVote.winnerId}>${lastVote.loserId}`,
    req,
  });
  return { ok: true, undone: lastVote };
});
