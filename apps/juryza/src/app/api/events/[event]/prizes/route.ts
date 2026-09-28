import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, prize } from "@/lib/db";
import { id } from "@/lib/ids";
import { audit } from "@/lib/server/audit";
import { loadEvent, loadManagedEvent } from "@/lib/server/events";
import { handle, readBody } from "@/lib/server/http";
import { requireUser, resolveIdentity } from "@/lib/server/identity";

type P = { event: string };

/**
 * GET /api/events/:event/prizes — the prize table.
 * PUT /api/events/:event/prizes — replace it. A prize is awarded by overall
 *     judged `rank`, by `rank` within one track (`kind: "track"`), or by
 *     community vote (`kind: "community"`). Winners are derived, never stored.
 */

const list = (eventId: string) =>
  db
    .select()
    .from(prize)
    .where(eq(prize.eventId, eventId))
    .orderBy(asc(prize.kind), asc(prize.rank));

export const GET = handle<P>(async (req, { event: ref }) => {
  const e = await loadEvent(ref, await resolveIdentity(req));
  return { prizes: await list(e.id) };
});

const body = z.object({
  prizes: z
    .array(
      z.object({
        kind: z.enum(["overall", "track", "community"]).default("overall"),
        trackId: z.string().nullish(),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(400).nullish(),
        amount: z.string().trim().max(40).nullish(),
        rank: z.number().int().min(1).max(50).default(1),
      })
    )
    .max(40),
});

export const PUT = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const { prizes } = await readBody(req, body);
  await db.transaction(async (tx) => {
    await tx.delete(prize).where(eq(prize.eventId, e.id));
    if (prizes.length) {
      await tx.insert(prize).values(
        prizes.map((p) => ({
          id: id.prize(),
          eventId: e.id,
          kind: p.kind,
          trackId: p.kind === "track" ? (p.trackId ?? null) : null,
          name: p.name,
          description: p.description ?? null,
          amount: p.amount ?? null,
          rank: p.rank,
        }))
      );
    }
  });
  await audit({
    eventId: e.id,
    actor: me,
    action: "prizes.updated",
    detail: { count: prizes.length },
    req,
  });
  return { prizes: await list(e.id) };
});
