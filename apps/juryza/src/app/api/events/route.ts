import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, event, prize, rubricCriterion, track } from "@/lib/db";
import { id } from "@/lib/ids";

/**
 * Events (T1).
 *
 * `GET` lists events (public). `POST` creates an event with configurable dates,
 * tracks, prizes and a weighted rubric — organizer only. The weighted rubric is
 * the key differentiator called out in the spec: organizers set both the
 * criteria and their weights.
 */

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  submissionsOpen: z.string().datetime().optional(),
  submissionsClose: z.string().datetime(),
  votingOpen: z.string().datetime().optional(),
  votingClose: z.string().datetime().optional(),
  tracks: z.array(z.string()).default([]),
  prizes: z
    .array(
      z.object({ name: z.string(), amount: z.string().optional(), rank: z.number().optional() })
    )
    .default([]),
  rubric: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string().optional(),
        weight: z.number().positive().default(1),
      })
    )
    .default([]),
});

export async function GET() {
  const rows = await db.select().from(event).orderBy(desc(event.createdAt));
  return NextResponse.json({ events: rows });
}

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const existing = await db
    .select({ id: event.id })
    .from(event)
    .where(eq(event.slug, b.slug))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const eventId = id.event();
  await db.insert(event).values({
    id: eventId,
    name: b.name,
    slug: b.slug,
    description: b.description ?? null,
    submissionsOpen: b.submissionsOpen ? new Date(b.submissionsOpen) : null,
    submissionsClose: new Date(b.submissionsClose),
    votingOpen: b.votingOpen ? new Date(b.votingOpen) : null,
    votingClose: b.votingClose ? new Date(b.votingClose) : null,
    createdBy: identity.userId,
  });

  for (const name of b.tracks) {
    await db.insert(track).values({ id: id.track(), eventId, name });
  }
  for (const [i, p] of b.prizes.entries()) {
    await db.insert(prize).values({
      id: id.prize(),
      eventId,
      name: p.name,
      amount: p.amount ?? null,
      rank: p.rank ?? i + 1,
    });
  }
  for (const [i, c] of b.rubric.entries()) {
    await db.insert(rubricCriterion).values({
      id: id.criterion(),
      eventId,
      key: c.key,
      label: c.label,
      description: c.description ?? null,
      weight: c.weight,
      position: i,
    });
  }

  await audit({ eventId, actor: identity, action: "event.created", target: eventId });
  return NextResponse.json({ id: eventId }, { status: 201 });
}
