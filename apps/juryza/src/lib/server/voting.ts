import { cookies } from "next/headers";

import { and, eq, isNotNull } from "drizzle-orm";

import type { Event } from "@/lib/db";
import { db, voter } from "@/lib/db";
import { secretToken } from "@/lib/ids";
import { hashToken, type Identity } from "@/lib/server/identity";

/**
 * Who is voting? Resolves the caller to a stable `voterKey` under the event's
 * access mode — the identity every duplicate check and budget is keyed on.
 *
 *  - `authenticated`: signed-in users only → `user:<id>`.
 *  - `email`: an address proven with a one-time code (optionally restricted to
 *    allowed domains) → `email:<address>`. Signed-in users vote as themselves.
 *  - `open`: anyone with the link. Signed-in users vote as themselves; anonymous
 *    voters get an httpOnly cookie → `anon:<cookie>`, further limited per IP.
 */

export type VoterState =
  | { status: "ready"; voterKey: string; label: string }
  | { status: "sign-in" }
  | { status: "verify-email" };

const ANON_COOKIE = "jz_anon";
export const voterCookie = (eventId: string) => `jz_voter_${eventId}`;

export async function resolveVoter(
  e: Event,
  me: Identity | null,
  opts: { createAnon?: boolean } = {}
): Promise<VoterState> {
  if (me) return { status: "ready", voterKey: `user:${me.userId}`, label: me.name };
  if (e.votingAccess === "authenticated") return { status: "sign-in" };

  const jar = await cookies();
  if (e.votingAccess === "email") {
    const token = jar.get(voterCookie(e.id))?.value;
    if (!token) return { status: "verify-email" };
    const [v] = await db
      .select({ email: voter.email })
      .from(voter)
      .where(
        and(
          eq(voter.eventId, e.id),
          eq(voter.sessionHash, hashToken(token)),
          isNotNull(voter.verifiedAt)
        )
      )
      .limit(1);
    return v
      ? { status: "ready", voterKey: `email:${v.email}`, label: v.email }
      : { status: "verify-email" };
  }

  let anon = jar.get(ANON_COOKIE)?.value;
  if (!anon && opts.createAnon) {
    anon = secretToken(24);
    jar.set(ANON_COOKIE, anon, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
  }
  return anon
    ? { status: "ready", voterKey: `anon:${hashToken(anon).slice(0, 32)}`, label: "Guest voter" }
    : { status: "verify-email" };
}

export function emailAllowed(e: Pick<Event, "votingEmailDomains">, email: string): boolean {
  if (e.votingEmailDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return e.votingEmailDomains.some(
    (d) => domain === d.replace(/^@/, "") || domain.endsWith(`.${d.replace(/^@/, "")}`)
  );
}
