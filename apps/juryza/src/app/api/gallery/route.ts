import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, desc, eq, ilike, or } from "drizzle-orm";

import { db, project, track } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * Public gallery (T1).
 *
 * No auth: a stranger can browse. Returns submitted projects for the active
 * event, newest first, with the track name joined in. Supports `?q=` full-text
 * search over title/tagline/summary and `?track=<trackId>` filtering — the
 * search-and-filter the tier requires.
 *
 * The acceptance checker hits this with no header and expects 200, and expects a
 * known fixture project title in the body — so titles are returned in the JSON.
 */
export async function GET(req: NextRequest) {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) {
    return NextResponse.json({ projects: [], event: null });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const trackId = url.searchParams.get("track")?.trim();

  const filters = [eq(project.eventId, activeEvent.id), eq(project.status, "submitted")];
  if (trackId) filters.push(eq(project.trackId, trackId));
  if (q) {
    const like = `%${q}%`;
    const search = or(
      ilike(project.title, like),
      ilike(project.tagline, like),
      ilike(project.summary, like)
    );
    if (search) filters.push(search);
  }

  const rows = await db
    .select({
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      summary: project.summary,
      repoUrl: project.repoUrl,
      liveUrl: project.liveUrl,
      videoUrl: project.videoUrl,
      thumbnailUrl: project.thumbnailUrl,
      techTags: project.techTags,
      trackId: project.trackId,
      trackName: track.name,
      submittedAt: project.submittedAt,
    })
    .from(project)
    .leftJoin(track, eq(project.trackId, track.id))
    .where(and(...filters))
    .orderBy(desc(project.submittedAt));

  return NextResponse.json({
    event: { id: activeEvent.id, name: activeEvent.name },
    count: rows.length,
    projects: rows,
  });
}
