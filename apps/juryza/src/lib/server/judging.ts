import { and, eq } from "drizzle-orm";

import type { AssignableJudge } from "@/lib/assignment";
import { assignment, db, eventJudge, project, team, teamMember } from "@/lib/db";

/** Data loaders for the assignment planner. */

export async function panelForPlanning(eventId: string): Promise<AssignableJudge[]> {
  const [panel, memberships] = await Promise.all([
    db.select().from(eventJudge).where(eq(eventJudge.eventId, eventId)),
    // Which projects each person helped make — their conflicts of interest.
    db
      .select({ userId: teamMember.userId, projectId: project.id })
      .from(teamMember)
      .innerJoin(team, eq(team.id, teamMember.teamId))
      .innerJoin(project, eq(project.teamId, team.id))
      .where(eq(team.eventId, eventId)),
  ]);
  const conflicts = new Map<string, Set<string>>();
  for (const m of memberships)
    conflicts.set(m.userId, (conflicts.get(m.userId) ?? new Set()).add(m.projectId));
  return panel.map((j) => ({
    id: j.userId,
    tracks: j.trackIds,
    conflicts: conflicts.get(j.userId),
  }));
}

export function submittedProjects(eventId: string) {
  return db
    .select({ id: project.id, trackId: project.trackId })
    .from(project)
    .where(and(eq(project.eventId, eventId), eq(project.status, "submitted")));
}

export function existingAssignments(eventId: string) {
  return db
    .select({ judgeId: assignment.judgeId, projectId: assignment.projectId })
    .from(assignment)
    .where(eq(assignment.eventId, eventId));
}
