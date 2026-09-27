import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { resolveIdentity } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { comment, db, project } from "@/lib/db";
import { id } from "@/lib/ids";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Comments on a gallery project (T3).
 *
 * `GET` is public and lists the thread. `POST` adds a comment; it is rate
 * limited per IP (anti-spam) and requires authentication so every comment has an
 * accountable author. Each write is audited.
 */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const rows = await db
    .select({
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
    })
    .from(comment)
    .where(eq(comment.projectId, projectId))
    .orderBy(asc(comment.createdAt));
  return NextResponse.json({ comments: rows });
}

const postSchema = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;

  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });

  const ip = clientIp(req);
  const rl = rateLimit(`comment:${identity.userId}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rows = await db
    .select({ eventId: project.eventId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  const proj = rows[0];
  if (!proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const commentId = id.comment();
  await db.insert(comment).values({
    id: commentId,
    eventId: proj.eventId,
    projectId,
    authorId: identity.userId,
    authorName: identity.name || identity.email,
    body: parsed.data.body,
  });

  await audit({
    eventId: proj.eventId,
    actor: identity,
    action: "comment.posted",
    target: projectId,
    ipAddress: ip,
  });

  return NextResponse.json({ id: commentId }, { status: 201 });
}
