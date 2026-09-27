import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { certificate, db } from "@/lib/db";
import { canonicalize, verify } from "@/lib/signing";

/**
 * Public certificate verification (T4).
 *
 * Anyone — no account — can fetch a certificate by serial and see whether its
 * signature is valid. The endpoint recomputes the HMAC over the same canonical
 * fields and compares, so a tampered `reviewsCompleted` or `subjectName` makes
 * `valid: false`. This is what "publicly verifiable" means: trust the maths, not
 * the pixels.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ serial: string }> }) {
  const { serial } = await ctx.params;
  const rows = await db.select().from(certificate).where(eq(certificate.serial, serial)).limit(1);
  const cert = rows[0];
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canonical = canonicalize({
    serial: cert.serial,
    event: cert.eventId,
    subject: cert.subjectId,
    kind: cert.kind,
    reviews: cert.reviewsCompleted,
  });
  const valid = verify(canonical, cert.signature);

  return NextResponse.json({
    serial: cert.serial,
    subjectName: cert.subjectName,
    kind: cert.kind,
    statement: cert.statement,
    reviewsCompleted: cert.reviewsCompleted,
    issuedAt: cert.issuedAt,
    signature: cert.signature,
    valid,
  });
}
