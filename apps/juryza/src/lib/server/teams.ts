import { asc, eq, sql } from "drizzle-orm";

import { db, project, team, teamMember, user as userTable } from "@/lib/db";

/** Team read helpers shared by the team routes and server-rendered pages. */

export async function teamMembers(teamId: string) {
  return db
    .select({
      id: userTable.id,
      name: userTable.name,
      username: userTable.username,
      image: userTable.image,
      headline: userTable.headline,
      role: teamMember.role,
      joinedAt: teamMember.joinedAt,
    })
    .from(teamMember)
    .innerJoin(userTable, eq(userTable.id, teamMember.userId))
    .where(eq(teamMember.teamId, teamId))
    .orderBy(asc(teamMember.joinedAt));
}

export async function memberCount(teamId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teamMember)
    .where(eq(teamMember.teamId, teamId));
  return row?.n ?? 0;
}

export async function teamProject(teamId: string) {
  const [p] = await db
    .select({ id: project.id, title: project.title, status: project.status })
    .from(project)
    .where(eq(project.teamId, teamId))
    .limit(1);
  return p ?? null;
}

export async function findTeam(teamId: string) {
  const [t] = await db.select().from(team).where(eq(team.id, teamId)).limit(1);
  return t ?? null;
}

export const inviteUrl = (origin: string, token: string) => `${origin}/join/${token}`;
