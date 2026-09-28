import { eq } from "drizzle-orm";

import { announcement, db } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { loadManagedEvent } from "@/lib/server/events";
import { handle, notFound } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";

/** DELETE /api/announcements/:id — remove an announcement (the event's organizers). */
export const DELETE = handle<{ id: string }>(async (req, { id: annId }) => {
  const me = await requireUser(req);
  const [a] = await db.select().from(announcement).where(eq(announcement.id, annId)).limit(1);
  if (!a) throw notFound("Announcement not found");
  await loadManagedEvent(a.eventId, me);
  await db.delete(announcement).where(eq(announcement.id, annId));
  await audit({
    eventId: a.eventId,
    actor: me,
    action: "announcement.deleted",
    target: annId,
    req,
  });
  return { ok: true };
});
