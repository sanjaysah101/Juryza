import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { forbidden, isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, project, teamMember } from "@/lib/db";
import { getActiveEvent, submissionsOpen } from "@/lib/events";
import type { Identity } from "@/lib/api-auth";
import type { Project } from "@/lib/db";

/**
 * A single project: read, edit-until-deadline, submit (T1).
 *
 * Editing is refused once the event has closed — the draft-and-edit window ends
 * at the deadline, enforced in the backend. Only a member of the owning team (or
 * an organizer/admin) may edit.
 */

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  trackId: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  repoUrl: z.string().url().nullable().optional().or(z.literal("")),
  liveUrl: z.string().url().nullable().optional().or(z.literal("")),
  videoUrl: z.string().url().nullable().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().nullable().optional().or(z.literal("")),
  techTags: z.array(z.string()).optional(),
  submit: z.boolean().optional(),
});

async function canEdit(identity: Identity, proj: Project): Promise<boolean> {
  if (identity.role === "organizer" || identity.role === "admin") return true;
  if (!proj.teamId) return false;
  const rows = await db
    .select({ userId: teamMember.userId })
    .from(teamMember)
    .where(and(eq(teamMember.teamId, proj.teamId), eq(teamMember.userId, identity.userId)))
    .limit(1);
  return rows.length > 0;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await db.select().from(project).where(eq(project.id, id)).limit(1);
  const proj = rows[0];
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Submitted projects are public (they show in the gallery). Drafts require the
  // caller to be on the team or an organizer.
  if (proj.status !== "submitted") {
    const identity = await requireRole(req, { min: "participant" });
    if (isResponse(identity)) return identity;
    if (!(await canEdit(identity, proj))) return forbidden();
  }
  return NextResponse.json({ project: proj });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const rows = await db.select().from(project).where(eq(project.id, id)).limit(1);
  const proj = rows[0];
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEdit(identity, proj))) return forbidden("Not your project");

  const activeEvent = await getActiveEvent();
  // Deadline enforcement: no edits after close (organizers excepted so they can
  // fix data during judging).
  if (
    activeEvent &&
    !submissionsOpen(activeEvent) &&
    identity.role !== "organizer" &&
    identity.role !== "admin"
  ) {
    return forbidden("Submissions are closed; project can no longer be edited");
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;

  const patch: Partial<Project> = { updatedAt: new Date() };
  if (b.title !== undefined) patch.title = b.title;
  if (b.trackId !== undefined) patch.trackId = b.trackId;
  if (b.tagline !== undefined) patch.tagline = b.tagline;
  if (b.summary !== undefined) patch.summary = b.summary;
  if (b.description !== undefined) patch.description = b.description;
  if (b.repoUrl !== undefined) patch.repoUrl = b.repoUrl || null;
  if (b.liveUrl !== undefined) patch.liveUrl = b.liveUrl || null;
  if (b.videoUrl !== undefined) patch.videoUrl = b.videoUrl || null;
  if (b.thumbnailUrl !== undefined) patch.thumbnailUrl = b.thumbnailUrl || null;
  if (b.techTags !== undefined) patch.techTags = b.techTags;
  if (b.submit) {
    patch.status = "submitted";
    patch.submittedAt = proj.submittedAt ?? new Date();
  }

  await db.update(project).set(patch).where(eq(project.id, id));
  await audit({
    eventId: proj.eventId,
    actor: identity,
    action: b.submit ? "project.submitted" : "project.updated",
    target: id,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ id, status: patch.status ?? proj.status });
}
