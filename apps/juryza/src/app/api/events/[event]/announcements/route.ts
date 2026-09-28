import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { announcement, db } from "@/lib/db";
import { id } from "@/lib/ids";
import { audit } from "@/lib/server/audit";
import { loadEvent, loadManagedEvent } from "@/lib/server/events";
import { created, handle, readBody } from "@/lib/server/http";
import { requireUser, resolveIdentity } from "@/lib/server/identity";
import { richDoc } from "@/lib/server/validation";

type P = { event: string };

/**
 * GET  /api/events/:event/announcements — organizer updates, pinned first.
 * POST /api/events/:event/announcements — post one (organizers).
 * Delete with DELETE /api/announcements/:id.
 */

export const GET = handle<P>(async (req, { event: ref }) => {
  const e = await loadEvent(ref, await resolveIdentity(req));
  return {
    announcements: await db
      .select()
      .from(announcement)
      .where(eq(announcement.eventId, e.id))
      .orderBy(sql`${announcement.pinned} desc`, desc(announcement.createdAt)),
  };
});

const body = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.union([z.string().trim().min(1), richDoc]),
  pinned: z.boolean().default(false),
});

export const POST = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const b = await readBody(req, body);
  const annId = id.announcement();
  const bodyText = typeof b.body === "string" ? b.body : JSON.stringify(b.body);
  await db.insert(announcement).values({
    id: annId,
    eventId: e.id,
    authorId: me.userId,
    title: b.title,
    body: bodyText,
    pinned: b.pinned,
  });
  await audit({
    eventId: e.id,
    actor: me,
    action: "announcement.posted",
    target: annId,
    detail: { title: b.title },
    req,
  });
  return created({ id: annId });
});
