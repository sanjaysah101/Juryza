import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, event } from "@/lib/db";
import { votingIsOpen } from "@/lib/phase";
import { audit } from "@/lib/server/audit";
import { canManage, loadEvent, loadManagedEvent } from "@/lib/server/events";
import { forbidden, handle, readBody } from "@/lib/server/http";
import { requireUser, resolveIdentity } from "@/lib/server/identity";
import { computeResults } from "@/lib/server/results";
import { dispatch } from "@/lib/server/webhooks";

type P = { event: string };

/**
 * GET  /api/events/:event/results — the leaderboard: normalized judged
 *      ranking, per-criterion means, track ranks, community votes, pairwise
 *      strength and prize winners. Hidden from everyone but the event's
 *      organizers until they publish; before that, the public response carries
 *      no numbers at all.
 * POST /api/events/:event/results { published, closeVoting? } — publish or
 *      unpublish. Publishing is refused while community voting is still open
 *      (results must never leak into a live vote) unless `closeVoting: true`,
 *      which ends the voting window now.
 */

export const GET = handle<P>(async (req, { event: ref }) => {
  const me = await resolveIdentity(req);
  const e = await loadEvent(ref, me);
  const manager = canManage(me, e);
  if (!e.resultsPublished && !manager) {
    return { published: false, event: { slug: e.slug, name: e.name } };
  }
  const results = await computeResults(e);
  return {
    published: e.resultsPublished,
    preview: !e.resultsPublished,
    event: { slug: e.slug, name: e.name },
    ...results,
    // Per-judge calibration is organizer-only: it identifies judges.
    judges: manager ? results.judges : undefined,
  };
});

const body = z.object({ published: z.boolean(), closeVoting: z.boolean().default(false) });

export const POST = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const { published, closeVoting } = await readBody(req, body);

  if (published && votingIsOpen(e) && !closeVoting) {
    throw forbidden("Community voting is still open. Close voting before publishing results.");
  }
  await db
    .update(event)
    .set({
      resultsPublished: published,
      ...(published && votingIsOpen(e) && { votingClose: new Date() }),
      updatedAt: new Date(),
    })
    .where(eq(event.id, e.id));

  await audit({
    eventId: e.id,
    actor: me,
    action: published ? "results.published" : "results.unpublished",
    req,
  });
  if (published) dispatch("results.published", { name: e.name, slug: e.slug }, e.id);
  return { published };
});
