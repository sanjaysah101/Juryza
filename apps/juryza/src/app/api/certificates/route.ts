import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { certificate, db, score, user as userTable } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id } from "@/lib/ids";
import { canonicalize, sign } from "@/lib/signing";

/**
 * Judge participation certificates (T4). Organizer/admin issues them.
 *
 * A certificate is a signed, publicly verifiable record. The signature is an
 * HMAC over the canonical fields (serial, event, subject, kind, reviews), so
 * anyone can re-verify at `/api/certificates/<serial>` — the display cannot be
 * forged without the signing key.
 *
 * `POST { subjectId }` issues a judge-participation certificate, stamping the
 * number of reviews that judge completed for the active event.
 */

const issueSchema = z.object({
  subjectId: z.string().min(1),
  kind: z.enum(["judge-participation", "winner"]).default("judge-participation"),
});

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "organizer" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = issueSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const subjects = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, parsed.data.subjectId))
    .limit(1);
  const subject = subjects[0];
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const reviewRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(score)
    .where(and(eq(score.eventId, activeEvent.id), eq(score.judgeId, subject.id)));
  const reviews = reviewRows[0]?.n ?? 0;

  const serial = `JZ-${activeEvent.id}-${subject.id}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 48);
  const statement =
    parsed.data.kind === "judge-participation"
      ? `${subject.name} served as a judge for ${activeEvent.name}, completing ${reviews} reviews.`
      : `${subject.name} is recognized for ${activeEvent.name}.`;

  // Sign the canonical record. The same fields are re-hashed on verify.
  const canonical = canonicalize({
    serial,
    event: activeEvent.id,
    subject: subject.id,
    kind: parsed.data.kind,
    reviews,
  });
  const signature = sign(canonical);

  const certId = id.audit();
  await db
    .insert(certificate)
    .values({
      id: certId,
      serial,
      eventId: activeEvent.id,
      subjectId: subject.id,
      subjectName: subject.name,
      kind: parsed.data.kind,
      statement,
      reviewsCompleted: reviews,
      signature,
    })
    .onConflictDoNothing();

  await audit({
    eventId: activeEvent.id,
    actor: identity,
    action: "certificate.issued",
    target: serial,
    detail: { subject: subject.id, kind: parsed.data.kind, reviews },
  });

  return NextResponse.json(
    { serial, statement, signature, verifyUrl: `/api/certificates/${serial}` },
    { status: 201 }
  );
}
