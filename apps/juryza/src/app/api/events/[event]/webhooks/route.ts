import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, webhook, webhookDelivery } from "@/lib/db";
import { id, secretToken } from "@/lib/ids";
import { audit } from "@/lib/server/audit";
import { loadManagedEvent } from "@/lib/server/events";
import { created, handle, readBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { WEBHOOK_EVENTS } from "@/lib/server/webhooks";

type P = { event: string };

/**
 * GET  /api/events/:event/webhooks — subscriptions (secrets redacted) with
 *      their 20 most recent deliveries, and the list of event types.
 * POST /api/events/:event/webhooks { url, events } — subscribe. The signing
 *      secret is returned once, in this response only.
 */

export const GET = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const hooks = await db
    .select()
    .from(webhook)
    .where(eq(webhook.eventId, e.id))
    .orderBy(desc(webhook.createdAt));
  const deliveries = hooks.length
    ? await db
        .select()
        .from(webhookDelivery)
        .where(
          inArray(
            webhookDelivery.webhookId,
            hooks.map((h) => h.id)
          )
        )
        .orderBy(desc(webhookDelivery.createdAt))
        .limit(200)
    : [];
  return {
    types: WEBHOOK_EVENTS,
    webhooks: hooks.map(({ secret, ...h }) => ({
      ...h,
      secretHint: `${secret.slice(0, 4)}…`,
      deliveries: deliveries.filter((d) => d.webhookId === h.id).slice(0, 20),
    })),
  };
});

const body = z.object({
  url: z.url({ protocol: /^https?$/, message: "Must be an http(s) URL" }),
  events: z.array(z.enum(WEBHOOK_EVENTS)).default([]),
});

export const POST = handle<P>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const b = await readBody(req, body);
  const hookId = id.webhook();
  const secret = `whsec_${secretToken(32)}`;
  await db.insert(webhook).values({
    id: hookId,
    eventId: e.id,
    url: b.url,
    events: b.events,
    secret,
    createdBy: me.userId,
  });
  await audit({
    eventId: e.id,
    actor: me,
    action: "webhook.created",
    target: hookId,
    detail: { url: b.url },
    req,
  });
  return created({ id: hookId, secret });
});
