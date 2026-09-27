import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import type { Role } from "@/lib/auth-better-auth-server";
import { auth as betterAuth } from "@/lib/auth-better-auth-server";
import { apiToken, db, user as userTable } from "@/lib/db";

/**
 * Request → identity resolution for API routes.
 *
 * This is the single place role is established on the backend, so every
 * protected route derives its authorization from the same source. It supports
 * two credentials, in priority order:
 *
 * 1. **`Authorization: Bearer <token>`** — a long-lived `api_token` row. This is
 *    what the acceptance checker uses: it attaches a static header per role and
 *    never logs in. Also the credential for the T4 REST API.
 * 2. **Better Auth session cookie** — for requests coming from the app's own UI.
 *
 * A request that carries neither resolves to `null` (an anonymous visitor).
 *
 * Authorization is enforced HERE, not in any component. `judge_b` asking for
 * `judge_a`'s scores is refused because this resolver returns judge_b's id and
 * the route compares it — hiding a button in the template would not.
 */

export interface Identity {
  userId: string;
  role: Role;
  email: string;
  name: string;
}

export async function resolveIdentity(req: NextRequest): Promise<Identity | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const rows = await db
      .select({
        userId: apiToken.userId,
        role: userTable.role,
        email: userTable.email,
        name: userTable.name,
      })
      .from(apiToken)
      .innerJoin(userTable, eq(apiToken.userId, userTable.id))
      .where(eq(apiToken.token, token))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    // Best-effort last-used stamp; never block the request on it.
    void db
      .update(apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiToken.token, token))
      .catch(() => {});
    return {
      userId: row.userId,
      role: (row.role as Role) ?? "participant",
      email: row.email,
      name: row.name,
    };
  }

  // Fall back to a Better Auth session cookie for first-party UI requests.
  const session = await betterAuth.api.getSession({ headers: req.headers });
  if (session?.user) {
    return {
      userId: session.user.id,
      role: ((session.user as { role?: string }).role as Role) ?? "participant",
      email: session.user.email ?? "",
      name: session.user.name ?? "",
    };
  }

  return null;
}

/** Standard refusals. 401 = who are you; 403 = you, but not allowed. */
export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Insufficient role") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Role hierarchy: a higher rank implies every capability below it. */
const RANK: Record<Role, number> = {
  visitor: 0,
  participant: 1,
  judge: 2,
  organizer: 3,
  admin: 4,
};

export function hasAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * Guard helper: resolves identity and enforces an exact-role or minimum-role
 * requirement. Returns the identity on success, or a `NextResponse` (401/403) to
 * return directly on failure.
 *
 * `exact` is used where a higher role must NOT inherit the capability — a judge's
 * own-scores endpoint accepts only `judge`, so an organizer hitting it is treated
 * as any other non-judge (kept strict to make role boundaries testable).
 */
export async function requireRole(
  req: NextRequest,
  opts: { min?: Role; exact?: Role }
): Promise<Identity | NextResponse> {
  const identity = await resolveIdentity(req);
  if (!identity) return unauthorized();

  if (opts.exact && identity.role !== opts.exact) {
    return forbidden(`Requires role ${opts.exact}`);
  }
  if (opts.min && !hasAtLeast(identity.role, opts.min)) {
    return forbidden(`Requires at least role ${opts.min}`);
  }
  return identity;
}

export function isResponse(x: Identity | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}
