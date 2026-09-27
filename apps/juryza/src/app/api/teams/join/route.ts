import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, team, teamMember } from "@/lib/db";

/**
 * Join a team by invite token (T1).
 *
 * The whole invite flow, per the project's design decision: hold the link, join
 * the team. No pending-invitation row, no accept step. The token is the
 * capability. Idempotent — joining twice is a no-op.
 */

const joinSchema = z.object({ inviteToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const parsed = joinSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(team)
    .where(eq(team.inviteToken, parsed.data.inviteToken))
    .limit(1);
  const found = rows[0];
  if (!found) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });

  await db
    .insert(teamMember)
    .values({ teamId: found.id, userId: identity.userId, role: "member" })
    .onConflictDoNothing();

  await audit({ eventId: found.eventId, actor: identity, action: "team.joined", target: found.id });

  return NextResponse.json({ teamId: found.id, teamName: found.name });
}
