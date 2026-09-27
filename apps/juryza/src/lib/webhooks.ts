import { and, eq, or } from "drizzle-orm";

import { db, webhook, webhookDelivery } from "@/lib/db";
import { id } from "@/lib/ids";
import { sign } from "@/lib/signing";

/**
 * Webhook dispatch (T4).
 *
 * `dispatch(eventType, payload)` finds active subscriptions matching the event
 * type (or subscribed to all) and POSTs the signed payload to each, recording
 * every attempt. Fire-and-forget from the caller's perspective: a webhook that
 * is slow or down must never block the API action that triggered it, so failures
 * are logged, not thrown.
 *
 * Signature: `X-Juryza-Signature: sha256=<hex>` over the raw JSON body, so a
 * receiver verifies authenticity with the shared secret.
 */
export async function dispatch(
  eventType: string,
  payload: Record<string, unknown>,
  eventId?: string | null
): Promise<void> {
  const hooks = await db
    .select()
    .from(webhook)
    .where(
      and(
        eq(webhook.active, true),
        eventId ? or(eq(webhook.eventId, eventId), eq(webhook.eventId, null as never)) : undefined
      )
    );

  const body = JSON.stringify({ type: eventType, sentAt: new Date().toISOString(), data: payload });

  await Promise.all(
    hooks
      .filter((h) => !h.events?.length || h.events.includes(eventType))
      .map(async (h) => {
        const signature = sign(body);
        let status: number | null = null;
        let ok = false;
        let error: string | null = null;
        try {
          const res = await fetch(h.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Juryza-Event": eventType,
              "X-Juryza-Signature": `sha256=${signature}`,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          status = res.status;
          ok = res.ok;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
        await db
          .insert(webhookDelivery)
          .values({
            id: id.audit(),
            webhookId: h.id,
            eventType,
            payload,
            status,
            ok,
            error,
          })
          .catch(() => {});
      })
  );
}
