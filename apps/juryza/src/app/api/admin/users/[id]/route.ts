import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, session, user as userTable } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { badRequest, handle, notFound, readBody } from "@/lib/server/http";
import { requireRole } from "@/lib/server/identity";

/**
 * PATCH /api/admin/users/:id { role?, banned? } — change a platform role or
 * suspend an account (admins). Suspending signs the user out everywhere.
 * Admins cannot demote or suspend themselves, so an instance always keeps one.
 */
const body = z.object({
  role: z.enum(["participant", "judge", "organizer", "admin"]).optional(),
  banned: z.boolean().optional(),
});

export const PATCH = handle<{ id: string }>(async (req, { id: userId }) => {
  const me = await requireRole(req, "admin");
  const b = await readBody(req, body);
  if (userId === me.userId) throw badRequest("You cannot change your own role or suspend yourself");
  const [u] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!u) throw notFound("User not found");

  await db
    .update(userTable)
    .set({
      ...(b.role && { role: b.role }),
      ...(b.banned !== undefined && { banned: b.banned }),
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));
  if (b.banned) await db.delete(session).where(eq(session.userId, userId));
  await audit({
    actor: me,
    action: b.role ? "user.role_changed" : "user.suspension_changed",
    target: userId,
    detail: { from: u.role, ...b },
    req,
  });
  return { ok: true };
});
