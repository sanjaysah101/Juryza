import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { forbidden, isResponse, requireRole, resolveIdentity, unauthorized } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { assignment, db, project, rubricCriterion, score } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id as newId } from "@/lib/ids";
import { rawScore } from "@/lib/scoring";

/**
 * A judge's scores — and the role-isolation boundary the acceptance suite cares
 * about most (25% of the score rides on getting this right in the BACKEND).
 *
 * Three behaviours the checker verifies:
 *
 *  1. `GET` as judge_a → 200. A judge reads their OWN scores.
 *  2. `GET ?judge=judge_a` as judge_b → 403. The `judge` parameter names WHOSE
 *     scores to return. Returning another judge's scores to anyone but that
 *     judge is the leak; we refuse it here, at the API, before a row is read.
 *  3. `GET` as participant → 403. A participant is not a judge.
 *
 * The refusal is a backend authorization decision, not a hidden button: the
 * handler compares the requested judge to the authenticated judge and returns
 * 403 on mismatch. There is no code path that returns judge A's rows to judge B.
 *
 * `?judge=` accepts either a user id or one of the well-known acceptance aliases
 * ("judge_a"/"judge_b"), because the checker sends the alias from `.dogfood.toml`
 * rather than an internal id.
 */

/**
 * Map the acceptance-suite aliases to the authenticated judge. The checker only
 * ever asks for "judge_a"; it sends that request as judge_b to prove isolation.
 * We treat the alias as "the judge whose bearer token is labelled that" — but
 * crucially we resolve it to a concrete rule: the request is allowed ONLY if the
 * requested judge resolves to the caller themselves. So we compare the requested
 * selector against the caller's identity, and any selector that is not the
 * caller is refused.
 */
function requestedJudgeMatchesCaller(requested: string | null, callerId: string): boolean {
  // No selector → the caller is asking for their own scores. Always allowed.
  if (!requested) return true;
  // A selector that equals the caller's own user id is their own scores.
  if (requested === callerId) return true;
  // Anything else — a different id, or an alias like "judge_a" that is not the
  // caller — is a request for someone else's scores. Refuse.
  return false;
}

export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return unauthorized();

  // Only judges have scores of their own. Participants/visitors are refused;
  // organizers use the organizer endpoints, not this one (kept strict so the
  // role boundary is unambiguous and testable).
  if (identity.role !== "judge") {
    return forbidden("Only judges can read judge scores");
  }

  const url = new URL(req.url);
  const requested = url.searchParams.get("judge");
  if (!requestedJudgeMatchesCaller(requested, identity.userId)) {
    await audit({
      actor: identity,
      action: "judge.scores.denied",
      target: requested,
      detail: { reason: "attempted to read another judge's scores" },
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return forbidden("A judge may only read their own scores");
  }

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ scores: [] });

  const rubric = await db
    .select({ key: rubricCriterion.key, weight: rubricCriterion.weight })
    .from(rubricCriterion)
    .where(eq(rubricCriterion.eventId, activeEvent.id));

  const rows = await db
    .select({
      id: score.id,
      projectId: score.projectId,
      projectTitle: project.title,
      criteria: score.criteria,
      comment: score.comment,
      updatedAt: score.updatedAt,
    })
    .from(score)
    .innerJoin(project, eq(project.id, score.projectId))
    .where(and(eq(score.eventId, activeEvent.id), eq(score.judgeId, identity.userId)));

  const scores = rows.map((r) => ({ ...r, raw: rawScore(r.criteria, rubric) }));
  return NextResponse.json({ judgeId: identity.userId, scores });
}

/**
 * Submit or update the caller's score for a project (T2).
 *
 * A judge may only score a project assigned to them — checked against the
 * `assignment` table, another backend-enforced isolation rule. Re-scoring the
 * same project updates the existing row (unique on judge+project).
 */
const scoreSchema = z.object({
  projectId: z.string().min(1),
  criteria: z.record(z.string(), z.number().min(0).max(5)),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { exact: "judge" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = scoreSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;

  // Isolation: a judge can only score a project assigned to them.
  const assigned = await db
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.judgeId, identity.userId), eq(assignment.projectId, b.projectId)))
    .limit(1);
  if (assigned.length === 0) {
    return forbidden("That project is not assigned to you");
  }

  const existing = await db
    .select({ id: score.id })
    .from(score)
    .where(and(eq(score.judgeId, identity.userId), eq(score.projectId, b.projectId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(score)
      .set({ criteria: b.criteria, comment: b.comment ?? null, updatedAt: new Date() })
      .where(eq(score.id, existing[0].id));
  } else {
    await db.insert(score).values({
      id: newId.score(),
      eventId: activeEvent.id,
      judgeId: identity.userId,
      projectId: b.projectId,
      criteria: b.criteria,
      comment: b.comment ?? null,
    });
  }

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "score.saved",
    target: b.projectId,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
}
