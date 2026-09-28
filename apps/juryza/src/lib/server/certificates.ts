import { customAlphabet } from "nanoid";

import type { Certificate } from "@/lib/db";
import { canonicalize, hmac, verifyHmac } from "@/lib/server/signing";

/**
 * Signed, publicly verifiable certificates.
 *
 * The signature is an HMAC-SHA256 over the canonical record — serial, event,
 * subject, kind, statement, review count and issue time. Anyone can re-verify
 * at /certificates/<serial> (or the JSON API) without an account: change any
 * displayed field in the database and verification fails.
 */

const serialPart = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
export const newSerial = () => `JZ-${serialPart().slice(0, 5)}-${serialPart().slice(0, 5)}`;

type Signable = Pick<
  Certificate,
  "serial" | "eventId" | "subjectName" | "kind" | "statement" | "reviewsCompleted" | "issuedAt"
>;

const canonical = (c: Signable) =>
  canonicalize({
    serial: c.serial,
    event: c.eventId,
    subject: c.subjectName,
    kind: c.kind,
    statement: c.statement,
    reviews: c.reviewsCompleted,
    issued: c.issuedAt.toISOString(),
  });

export const signCertificate = (c: Signable) => hmac(canonical(c));
export const verifyCertificate = (c: Signable & { signature: string }) =>
  verifyHmac(canonical(c), c.signature);
