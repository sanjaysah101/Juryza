import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, webhook } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { loadManagedEvent } from "@/lib/server/events";
import { forbidden, handle, notFound, readBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { deliver, WEBHOOK_EVENTS } from "@/lib/server/webhooks";

type P = { id: string };

/**
 * PATCH  /api/webhooks/:id { active?, events?, url? } — update a subscription.
 * DELETE /api/webhooks/:id — remove it.
 * POST   /api/webhooks/:id — send a signed `ping` delivery now.
 */

async function load(req: Request, hookId: string) {
  const me = await requireUser(req);
  const [h] = await db.select().from(webhook).where(eq(webhook.id, hookId)).limit(1);
  if (!h) throw notFound("Webhook not found");
  if (!h.eventId) {
    if (me.role !== "admin") throw forbidden();
  } else {
    await loadManagedEvent(h.eventId, me);
  }
  return { me, h };
}

const patch = z.object({
  active: z.boolean().optional(),
  url: z.url({ protocol: /^https?$/ }).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
});

export const PATCH = handle<P>(async (req, { id: hookId }) => {
  const { me, h } = await load(req, hookId);
  const b = await readBody(req, patch);
  await db.update(webhook).set(b).where(eq(webhook.id, h.id));
  await audit({
    eventId: h.eventId,
    actor: me,
    action: "webhook.updated",
    target: h.id,
    detail: b,
    req,
  });
  return { ok: true };
});

export const DELETE = handle<P>(async (req, { id: hookId }) => {
  const { me, h } = await load(req, hookId);
  await db.delete(webhook).where(eq(webhook.id, h.id));
  await audit({ eventId: h.eventId, actor: me, action: "webhook.deleted", target: h.id, req });
  return { ok: true };
});

export const POST = handle<P>(async (req, { id: hookId }) => {
  const { h } = await load(req, hookId);
  return deliver(h, "ping", { message: "Hello from Juryza", eventId: h.eventId });
});
