import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { comment, db, project, user as userTable } from "@/lib/db";
import { id } from "@/lib/ids";
import { audit } from "@/lib/server/audit";
import { created, handle, notFound, readBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { dispatch } from "@/lib/server/webhooks";

type P = { id: string };

/**
 * GET  /api/projects/:id/comments — the public discussion thread.
 * POST /api/projects/:id/comments — add a comment. Signed-in users only, so
 *      every comment has an accountable author; 10 per minute per user.
 */

async function submittedProject(projectId: string) {
  const [p] = await db
    .select({ id: project.id, eventId: project.eventId, status: project.status })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (p?.status !== "submitted") throw notFound("Project not found");
  return p;
}

export const GET = handle<P>(async (_req, { id: projectId }) => {
  await submittedProject(projectId);
  const comments = await db
    .select({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorUsername: userTable.username,
      authorImage: userTable.image,
    })
    .from(comment)
    .leftJoin(userTable, eq(userTable.id, comment.authorId))
    .where(eq(comment.projectId, projectId))
    .orderBy(asc(comment.createdAt));
  return { comments };
});

const body = z.object({ body: z.string().trim().min(1, "Write something first").max(2000) });

export const POST = handle<P>(async (req, { id: projectId }) => {
  const me = await requireUser(req);
  enforceRateLimit(`comment:${me.userId}`, 10, 60_000);
  const p = await submittedProject(projectId);
  const { body: text } = await readBody(req, body);

  const commentId = id.comment();
  await db.insert(comment).values({
    id: commentId,
    eventId: p.eventId,
    projectId,
    authorId: me.userId,
    authorName: me.name,
    body: text,
  });
  await audit({ eventId: p.eventId, actor: me, action: "comment.posted", target: projectId, req });
  dispatch("comment.posted", { projectId, commentId }, p.eventId);
  return created({ id: commentId });
});
