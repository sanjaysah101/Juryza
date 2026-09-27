import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { forbidden, isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, project, team, teamMember } from "@/lib/db";
import { getActiveEvent, submissionsOpen } from "@/lib/events";
import { id } from "@/lib/ids";

/**
 * Project submission (T1).
 *
 * `POST` creates a project against the active event. It is refused with 403 once
 * the event's `submissions_close` has passed — this is the check the acceptance
 * suite exercises by posting as a participant to a seeded, already-closed event.
 * Deadline enforcement lives HERE in the backend, not behind a disabled button.
 *
 * A submission must be authored by a participant who belongs to a team in the
 * event. Projects start as drafts and stay editable until the deadline (see
 * `[id]/route.ts`).
 */

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  teamId: z.string().optional(),
  trackId: z.string().optional(),
  tagline: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  repoUrl: z.string().url().optional().or(z.literal("")),
  liveUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  techTags: z.array(z.string()).optional(),
  submit: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) {
    return NextResponse.json({ error: "No active event" }, { status: 404 });
  }

  // Deadline enforcement — the heart of the T1 "closed event refuses
  // submissions" check. A closed event refuses new submissions outright.
  if (!submissionsOpen(activeEvent)) {
    await audit({
      eventId: activeEvent.id,
      actor: identity,
      action: "submission.rejected.closed",
      detail: { closedAt: activeEvent.submissionsClose },
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json(
      {
        error: "Submissions are closed",
        submissionsClose: activeEvent.submissionsClose,
      },
      { status: 403 }
    );
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;

  // The author must be on a team in this event (organizers/admins may pass an
  // explicit teamId to submit on a team's behalf).
  let teamId = body.teamId ?? null;
  if (!teamId) {
    const membership = await db
      .select({ teamId: teamMember.teamId })
      .from(teamMember)
      .innerJoin(team, eq(team.id, teamMember.teamId))
      .where(and(eq(teamMember.userId, identity.userId), eq(team.eventId, activeEvent.id)))
      .limit(1);
    teamId = membership[0]?.teamId ?? null;
  }
  if (!teamId) {
    return forbidden("You must belong to a team in this event to submit");
  }

  const projectId = id.project();
  await db.insert(project).values({
    id: projectId,
    eventId: activeEvent.id,
    teamId,
    trackId: body.trackId ?? null,
    title: body.title,
    tagline: body.tagline ?? null,
    summary: body.summary ?? null,
    description: body.description ?? null,
    repoUrl: body.repoUrl || null,
    liveUrl: body.liveUrl || null,
    videoUrl: body.videoUrl || null,
    thumbnailUrl: body.thumbnailUrl || null,
    techTags: body.techTags ?? [],
    status: body.submit ? "submitted" : "draft",
    submittedAt: body.submit ? new Date() : null,
  });

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: body.submit ? "project.submitted" : "project.created",
    target: projectId,
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json(
    { id: projectId, status: body.submit ? "submitted" : "draft" },
    { status: 201 }
  );
}

/**
 * List the caller's own projects (draft + submitted). Participants see the
 * projects of teams they belong to; organizers see all projects in the event.
 */
export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ projects: [] });

  if (identity.role === "organizer" || identity.role === "admin") {
    const all = await db.select().from(project).where(eq(project.eventId, activeEvent.id));
    return NextResponse.json({ projects: all });
  }

  const teams = await db
    .select({ teamId: teamMember.teamId })
    .from(teamMember)
    .where(eq(teamMember.userId, identity.userId));
  const teamIds = teams.map((t) => t.teamId);
  if (teamIds.length === 0) return NextResponse.json({ projects: [] });

  const mine = await db
    .select()
    .from(project)
    .where(and(eq(project.eventId, activeEvent.id), inArray(project.teamId, teamIds)));
  return NextResponse.json({ projects: mine });
}
