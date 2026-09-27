import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { hasAtLeast, resolveIdentity } from "@/lib/api-auth";
import { bradleyTerry } from "@/lib/bradley-terry";
import { db, pairwiseVote, project } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";

/**
 * Pairwise ranking via Bradley–Terry (T2 bonus).
 *
 * Recovers a global strength per project from every recorded comparison and
 * returns them ranked. Subject to the same hidden-until-published rule as the
 * absolute-score results: organizers can always see it; the public sees it only
 * after publication.
 */
export async function GET(req: NextRequest) {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) return NextResponse.json({ published: false, ranking: [] });

  const identity = await resolveIdentity(req);
  const isOrganizer = identity ? hasAtLeast(identity.role, "organizer") : false;
  if (!activeEvent.resultsPublished && !isOrganizer) {
    return NextResponse.json({ published: false, ranking: [] });
  }

  const comparisons = await db
    .select({ winnerId: pairwiseVote.winnerId, loserId: pairwiseVote.loserId })
    .from(pairwiseVote)
    .where(eq(pairwiseVote.eventId, activeEvent.id));

  const ranking = bradleyTerry(comparisons);

  const projects = await db
    .select({ id: project.id, title: project.title })
    .from(project)
    .where(eq(project.eventId, activeEvent.id));
  const titleById = new Map(projects.map((p) => [p.id, p.title]));

  return NextResponse.json({
    published: activeEvent.resultsPublished,
    method: "bradley-terry-mm",
    totalComparisons: comparisons.length,
    ranking: ranking.map((r, i) => ({
      rank: i + 1,
      projectId: r.projectId,
      title: titleById.get(r.projectId) ?? r.projectId,
      strength: r.strength,
      scaled: r.scaled,
      wins: r.wins,
      losses: r.losses,
      comparisons: r.comparisons,
    })),
  });
}
