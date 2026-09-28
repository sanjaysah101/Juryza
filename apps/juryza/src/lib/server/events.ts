import { and, eq, or } from "drizzle-orm";

import type { Event } from "@/lib/db";
import { db, event, eventJudge, registration, team, teamMember } from "@/lib/db";
import { forbidden, notFound } from "@/lib/server/http";
import type { Identity } from "@/lib/server/identity";

/**
 * Event lookup and the per-event permission rules.
 *
 *  - **Manage** an event: its creator, or an admin. (Organizer is the platform
 *    role that may *create* events; it does not grant power over other
 *    organizers' events.)
 *  - **Judge** an event: a member of its judging panel (`event_judge`).
 *  - **See** a draft event: managers only; published events are public.
 */

/** Find an event by id or slug. */
export async function findEvent(ref: string): Promise<Event | null> {
  const [row] = await db
    .select()
    .from(event)
    .where(or(eq(event.id, ref), eq(event.slug, ref)))
    .limit(1);
  return row ?? null;
}

export function canManage(me: Identity | null, e: Pick<Event, "createdBy">): boolean {
  if (!me) return false;
  return me.role === "admin" || (me.role === "organizer" && e.createdBy === me.userId);
}

/** Load an event the caller may see; drafts 404 for non-managers (no existence leak). */
export async function loadEvent(ref: string, me: Identity | null): Promise<Event> {
  const e = await findEvent(ref);
  if (!e || (e.visibility !== "published" && !canManage(me, e))) throw notFound("Event not found");
  return e;
}

export async function loadManagedEvent(ref: string, me: Identity): Promise<Event> {
  const e = await findEvent(ref);
  if (!e) throw notFound("Event not found");
  if (!canManage(me, e)) throw forbidden("Only this event's organizers can do that");
  return e;
}

export async function isPanelJudge(eventId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: eventJudge.userId })
    .from(eventJudge)
    .where(and(eq(eventJudge.eventId, eventId), eq(eventJudge.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/** The caller's team in an event, if any. A user is on at most one team per event. */
export async function teamOf(eventId: string, userId: string) {
  const [row] = await db
    .select({ id: team.id, name: team.name, role: teamMember.role })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(and(eq(team.eventId, eventId), eq(teamMember.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function register(eventId: string, userId: string) {
  await db.insert(registration).values({ eventId, userId }).onConflictDoNothing();
}
