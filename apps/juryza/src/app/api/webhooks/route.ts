import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, webhook } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id, secretToken } from "@/lib/ids";

/**
 * Webhook subscriptions (T4). Organizer/admin only.
 *
 * `GET` lists this event's webhooks (secret redacted). `POST` registers one and
 * returns the signing secret ONCE — deliveries are HMAC-signed with it so the
 * receiver can verify authenticity.
 */

export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  const rows = await db
    .select({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      createdAt: webhook.createdAt,
    })
    .from(webhook)
    .where(activeEvent ? eq(webhook.eventId, activeEvent.id) : undefined)
    .orderBy(desc(webhook.createdAt));
  return NextResponse.json({ webhooks: rows });
}

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const hookId = id.audit();
  const secret = secretToken();
  await db.insert(webhook).values({
    id: hookId,
    eventId: activeEvent?.id ?? null,
    url: parsed.data.url,
    secret,
    events: parsed.data.events,
    createdBy: identity.userId,
  });

  await audit({
    eventId: activeEvent?.id,
    actor: identity,
    action: "webhook.created",
    target: hookId,
    detail: { url: parsed.data.url },
  });

  // Return the secret once — it is not exposed again by GET.
  return NextResponse.json(
    { id: hookId, secret, url: parsed.data.url, events: parsed.data.events },
    { status: 201 }
  );
}
