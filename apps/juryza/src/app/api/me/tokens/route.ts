import type { NextRequest } from "next/server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { apiToken, db } from "@/lib/db";
import { id, secretToken } from "@/lib/ids";
import { audit } from "@/lib/server/audit";
import { created, handle, notFound, readBody } from "@/lib/server/http";
import { hashToken, requireUser } from "@/lib/server/identity";

/**
 * Personal API tokens.
 *
 * GET    /api/me/tokens — the caller's tokens (never the secret itself).
 * POST   /api/me/tokens { label } — mint one. The token is shown once; only
 *        its SHA-256 hash is stored. Use as `Authorization: Bearer <token>`.
 * DELETE /api/me/tokens?id=<tokenId> — revoke.
 */

export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  const tokens = await db
    .select({
      id: apiToken.id,
      label: apiToken.label,
      prefix: apiToken.prefix,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
    })
    .from(apiToken)
    .where(eq(apiToken.userId, me.userId))
    .orderBy(desc(apiToken.createdAt));
  return { tokens };
});

export const POST = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  const { label } = await readBody(req, z.object({ label: z.string().trim().min(1).max(60) }));
  const token = `jz_${secretToken(40)}`;
  const tokenId = id.apiToken();
  await db.insert(apiToken).values({
    id: tokenId,
    userId: me.userId,
    label,
    tokenHash: hashToken(token),
    prefix: token.slice(0, 9),
  });
  await audit({ actor: me, action: "token.created", target: tokenId, detail: { label }, req });
  return created({ id: tokenId, token });
});

export const DELETE = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  const tokenId = new URL(req.url).searchParams.get("id") ?? "";
  const res = await db
    .delete(apiToken)
    .where(and(eq(apiToken.id, tokenId), eq(apiToken.userId, me.userId)));
  if (!res.rowCount) throw notFound("Token not found");
  await audit({ actor: me, action: "token.revoked", target: tokenId, req });
  return { ok: true };
});
