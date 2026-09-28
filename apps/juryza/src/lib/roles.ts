/**
 * The platform role model: visitor < participant < judge < organizer < admin.
 *
 * A visitor is an unauthenticated request and is never stored. A higher role
 * implies the capabilities below it at the platform level; event-level powers
 * (who may manage an event, who sits on its judging panel) are checked per
 * event in `lib/server/events.ts`. Client-safe: no server imports.
 */
export const ROLES = ["visitor", "participant", "judge", "organizer", "admin"] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { visitor: 0, participant: 1, judge: 2, organizer: 3, admin: 4 };

export function hasAtLeast(role: string | null | undefined, min: Role): boolean {
  return (RANK[(role ?? "visitor") as Role] ?? 0) >= RANK[min];
}
