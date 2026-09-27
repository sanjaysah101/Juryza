import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, event, prize, project, rubricCriterion, track } from "@/lib/db";
import { id } from "@/lib/ids";

/**
 * Bulk import (T4) — the migration path IN.
 *
 * Organizer/admin posts an event bundle (the shape `export.json` produces, or a
 * hand-authored subset) and it is created as a NEW event with fresh ids, so an
 * import never clobbers an existing event. Projects/scores can be included; here
 * we import the event skeleton (event, tracks, prizes, rubric) and the projects,
 * which is the part an organizer most often carries between platforms. Ids are
 * remapped so the bundle is portable across instances.
 */

const importSchema = z.object({
  event: z.object({
    name: z.string(),
    slug: z.string().optional(),
    submissionsClose: z.string(),
    submissionsOpen: z.string().nullable().optional(),
  }),
  tracks: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  prizes: z
    .array(
      z.object({
        name: z.string(),
        amount: z.string().nullable().optional(),
        rank: z.number().nullable().optional(),
      })
    )
    .default([]),
  rubric: z
    .array(z.object({ key: z.string(), label: z.string(), weight: z.number().default(1) }))
    .default([]),
  projects: z
    .array(
      z.object({
        title: z.string(),
        track: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
        repoUrl: z.string().nullable().optional(),
      })
    )
    .default([]),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const parsed = importSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid bundle", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const eventId = id.event();
  const slug = `${(b.event.slug ?? b.event.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${eventId.slice(-6)}`;
  await db.insert(event).values({
    id: eventId,
    name: b.event.name,
    slug,
    submissionsOpen: b.event.submissionsOpen ? new Date(b.event.submissionsOpen) : null,
    submissionsClose: new Date(b.event.submissionsClose),
    createdBy: identity.userId,
  });

  // Remap track ids from the bundle to fresh ids for FK integrity.
  const trackIdMap = new Map<string, string>();
  for (const t of b.tracks) {
    const newId = id.track();
    trackIdMap.set(t.id, newId);
    await db.insert(track).values({ id: newId, eventId, name: t.name });
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
      weight: c.weight,
      position: i,
    });
  }
  let importedProjects = 0;
  for (const p of b.projects) {
    await db.insert(project).values({
      id: id.project(),
      eventId,
      teamId: null,
      trackId: p.track ? (trackIdMap.get(p.track) ?? null) : null,
      title: p.title,
      summary: p.summary ?? null,
      repoUrl: p.repoUrl ?? null,
      status: "submitted",
      submittedAt: new Date(),
    });
    importedProjects += 1;
  }

  await audit({
    eventId,
    actor: identity,
    action: "import.event",
    target: eventId,
    detail: { tracks: b.tracks.length, projects: importedProjects },
  });

  return NextResponse.json(
    { eventId, slug, tracks: b.tracks.length, prizes: b.prizes.length, projects: importedProjects },
    { status: 201 }
  );
}
