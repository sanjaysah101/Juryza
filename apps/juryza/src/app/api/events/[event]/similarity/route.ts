import { and, eq } from "drizzle-orm";

import { db, project, team } from "@/lib/db";
import { loadManagedEvent } from "@/lib/server/events";
import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { similarPairs } from "@/lib/similarity";

/**
 * GET /api/events/:event/similarity[?threshold=0.5] — automatic duplicate and
 * look-alike detection across the event's submissions (organizers). Each pair
 * carries a 0–1 similarity score, the reasons (same repository, identical
 * title, overlapping write-up) and the distinctive terms they share.
 */
export const GET = handle<{ event: string }>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const threshold = Math.min(
    1,
    Math.max(0.1, Number(new URL(req.url).searchParams.get("threshold")) || 0.5)
  );
  const rows = await db
    .select({
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      description: project.description,
      techTags: project.techTags,
      repoUrl: project.repoUrl,
      teamName: team.name,
      submittedAt: project.submittedAt,
    })
    .from(project)
    .leftJoin(team, eq(team.id, project.teamId))
    .where(and(eq(project.eventId, e.id), eq(project.status, "submitted")));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pick = (pid: string) => {
    const r = byId.get(pid);
    return (
      r && {
        id: r.id,
        title: r.title,
        teamName: r.teamName,
        repoUrl: r.repoUrl,
        submittedAt: r.submittedAt,
      }
    );
  };
  return {
    threshold,
    scanned: rows.length,
    pairs: similarPairs(rows, threshold).map((p) => ({ ...p, a: pick(p.a), b: pick(p.b) })),
  };
});
