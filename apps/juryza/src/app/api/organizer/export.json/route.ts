import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import {
  assignment,
  comment,
  db,
  event,
  prize,
  project,
  rubricCriterion,
  score,
  team,
  teamMember,
  track,
  vote,
} from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * Full event export as JSON (T4) — "a platform you cannot leave is a trap."
 *
 * Organizer/admin only. Dumps the entire event graph — tracks, prizes, rubric,
 * teams, members, projects, assignments, scores, votes, comments — in a shape
 * that `POST /api/organizer/import` can round-trip. This is the migration path
 * out; combined with the CSV export, an organizer leaves with everything.
 */
export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });
  const eventId = activeEvent.id;

  const where = <T extends { eventId: unknown }>(t: T) => eq(t.eventId as never, eventId);

  const [eventRow] = await db.select().from(event).where(eq(event.id, eventId));
  const [tracks, prizes, criteria, teams, projects, assignments, scores, votes, comments] =
    await Promise.all([
      db.select().from(track).where(where(track)),
      db.select().from(prize).where(where(prize)),
      db.select().from(rubricCriterion).where(where(rubricCriterion)),
      db.select().from(team).where(where(team)),
      db.select().from(project).where(where(project)),
      db.select().from(assignment).where(where(assignment)),
      db.select().from(score).where(where(score)),
      db.select().from(vote).where(where(vote)),
      db.select().from(comment).where(where(comment)),
    ]);

  const teamIds = teams.map((t) => t.id);
  const members = teamIds.length
    ? await db
        .select()
        .from(teamMember)
        .where(
          // members reference teamId, not eventId; filter in JS to keep it simple
          eq(teamMember.teamId, teamIds[0] as string)
        )
    : [];
  // Fetch all members for all teams (the single-id filter above is a fallback).
  const allMembers = await db.select().from(teamMember);
  const scopedMembers = allMembers.filter((m) => teamIds.includes(m.teamId));

  await audit({
    eventId,
    actor: identity,
    action: "export.json.full",
    detail: { projects: projects.length },
  });

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      event: eventRow,
      tracks,
      prizes,
      rubric: criteria,
      teams,
      teamMembers: scopedMembers.length ? scopedMembers : members,
      projects,
      assignments,
      scores,
      votes,
      comments,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="juryza-${eventId}-export.json"`,
      },
    }
  );
}
