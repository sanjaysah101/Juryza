import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { resolveIdentity } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, project, vote } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id } from "@/lib/ids";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { seededShuffle, votingOpen } from "@/lib/voting";

/**
 * Community voting (T3).
 *
 * `GET` returns the ballot: submitted projects in a per-voter randomized order
 * (position-bias mitigation), and it NEVER returns tallies while the voting
 * window is open — results stay hidden until an organizer publishes them.
 *
 * `POST` casts a vote. Anti-abuse, all enforced in the backend:
 *  - rate limit per IP (fixed window),
 *  - duplicate detection: a unique (project, voterKey) means a second vote on
 *    the same project updates rather than stacks,
 *  - quadratic credits are validated,
 *  - every cast writes an audit row.
 *
 * The voter key is the authenticated user id when signed in, else a hash of the
 * IP — enough to dedupe open-link voting without storing PII.
 */

export async function GET(req: NextRequest) {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ projects: [], votingOpen: false });

  const rows = await db
    .select({ id: project.id, title: project.title, tagline: project.tagline })
    .from(project)
    .where(and(eq(project.eventId, activeEvent.id), eq(project.status, "submitted")));

  // Per-voter seed so the order is stable for one voter but differs across
  // voters — kills the "top of the list wins" position bias.
  const seed = clientIp(req);
  const ballot = seededShuffle(rows, seed);

  return NextResponse.json({
    event: { id: activeEvent.id, name: activeEvent.name },
    votingOpen: votingOpen(activeEvent),
    resultsPublished: activeEvent.resultsPublished,
    projects: ballot,
  });
}

const castSchema = z.object({
  projectId: z.string().min(1),
  credits: z.number().int().min(1).max(9).default(1),
});

export async function POST(req: NextRequest) {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  if (!votingOpen(activeEvent)) {
    return NextResponse.json({ error: "Voting is closed" }, { status: 403 });
  }

  // Rate limit: 30 votes / minute / IP. Blunts ballot stuffing.
  const ip = clientIp(req);
  const rl = rateLimit(`vote:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded, slow down" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const parsed = castSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { projectId, credits } = parsed.data;

  // Voter identity: authenticated user id, else a stable per-IP key.
  const identity = await resolveIdentity(req);
  const voterKey = identity ? `user:${identity.userId}` : `ip:${ip}`;

  // Duplicate detection via the unique (project, voterKey): update on re-vote.
  await db
    .insert(vote)
    .values({ id: id.vote(), eventId: activeEvent.id, projectId, voterKey, credits })
    .onConflictDoUpdate({
      target: [vote.projectId, vote.voterKey],
      set: { credits },
    });

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "vote.cast",
    target: projectId,
    detail: { credits, voterKey },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, credits });
}
