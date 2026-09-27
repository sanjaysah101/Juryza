import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isResponse, requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { db, team, teamMember } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { id, secretToken } from "@/lib/ids";

/**
 * Teams (T1) — formation by invite link.
 *
 * `POST` creates a team in the active event; the caller becomes its owner and a
 * fresh invite token is minted. The join flow is deliberately lightweight per
 * the project's design decision: whoever holds the link can join, no
 * accept/decline handshake (see `/api/teams/join`). This keeps team formation to
 * "share a link", which is what the tier asks for.
 */

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ error: "No active event" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const teamId = id.team();
  const inviteToken = secretToken();
  await db.insert(team).values({
    id: teamId,
    eventId: activeEvent.id,
    name: parsed.data.name,
    inviteToken,
  });
  await db.insert(teamMember).values({ teamId, userId: identity.userId, role: "owner" });

  await audit({ eventId: activeEvent.id, actor: identity, action: "team.created", target: teamId });

  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      id: teamId,
      inviteToken,
      inviteUrl: `${origin}/teams/join/${inviteToken}`,
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const identity = await requireRole(req, { min: "participant" });
  if (isResponse(identity)) return identity;

  const rows = await db
    .select({ id: team.id, name: team.name, eventId: team.eventId, inviteToken: team.inviteToken })
    .from(team)
    .innerJoin(teamMember, eq(teamMember.teamId, team.id))
    .where(eq(teamMember.userId, identity.userId));
  return NextResponse.json({ teams: rows });
}
