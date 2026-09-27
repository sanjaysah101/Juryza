import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Access-control definitions for the five-role model (spec: visitor,
 * participant, judge, organizer, admin).
 *
 * Better Auth's admin plugin ships only `admin` and `user` roles by default, so
 * any custom role name (organizer, judge, …) must be declared here and passed to
 * the plugin. This is also where each role's coarse capabilities live; the
 * fine-grained, per-resource checks stay in the API routes (see `api-auth.ts`),
 * since that is where a curl actually arrives.
 *
 * We extend the admin plugin's default statements (user management) with
 * platform statements so an organizer/admin can be granted event, judging and
 * export capabilities through the same mechanism.
 */
const statement = {
  ...defaultStatements,
  event: ["create", "update", "delete", "publish"],
  judging: ["assign", "view-progress", "export"],
  project: ["create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

// A plain visitor/participant: no elevated capabilities.
export const participant = ac.newRole({
  project: ["create", "update"],
});

// Judges score assigned projects; no organizer powers.
export const judge = ac.newRole({});

// Organizers run the event: full event + judging + export, plus user admin.
export const organizer = ac.newRole({
  event: ["create", "update", "delete", "publish"],
  judging: ["assign", "view-progress", "export"],
  project: ["create", "update", "delete"],
  ...adminAc.statements,
});

// Admin: everything.
export const admin = ac.newRole({
  event: ["create", "update", "delete", "publish"],
  judging: ["assign", "view-progress", "export"],
  project: ["create", "update", "delete"],
  ...adminAc.statements,
});

// A "visitor" is an unauthenticated request, so it has no role object; it is
// listed in ROLES for completeness but never assigned to a user.
export const roles = { participant, judge, organizer, admin };
