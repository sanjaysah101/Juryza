import { eq } from "drizzle-orm";

import { certificate, db, event, user as userTable } from "@/lib/db";
import { verifyCertificate } from "@/lib/server/certificates";
import { handle, notFound } from "@/lib/server/http";

/**
 * GET /api/certificates/:serial — public verification, no account needed.
 * Recomputes the HMAC over the stored record; `valid: false` means the record
 * was altered after it was issued.
 */
export const GET = handle<{ serial: string }>(async (_req, { serial }) => {
  const [row] = await db
    .select({
      cert: certificate,
      eventName: event.name,
      eventSlug: event.slug,
      username: userTable.username,
    })
    .from(certificate)
    .innerJoin(event, eq(event.id, certificate.eventId))
    .leftJoin(userTable, eq(userTable.id, certificate.subjectId))
    .where(eq(certificate.serial, serial.toUpperCase()))
    .limit(1);
  if (!row) throw notFound("No certificate with that serial");
  const { cert } = row;
  return {
    serial: cert.serial,
    kind: cert.kind,
    subjectName: cert.subjectName,
    subjectUsername: row.username,
    statement: cert.statement,
    reviewsCompleted: cert.reviewsCompleted,
    event: { name: row.eventName, slug: row.eventSlug },
    issuedAt: cert.issuedAt,
    signature: cert.signature,
    algorithm: "HMAC-SHA256",
    valid: verifyCertificate(cert),
  };
});
