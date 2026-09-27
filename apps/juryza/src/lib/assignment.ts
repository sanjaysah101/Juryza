/**
 * Judge → project assignment strategies (T2).
 *
 * Two modes, both pure functions returning (judgeId, projectId) pairs so they
 * can be tested and previewed before anything is written:
 *
 * - **Round-robin** distributes projects across eligible judges so every project
 *   gets `reviewsPerProject` reviews and each judge's load is as even as
 *   possible. Judges are only offered projects in a track they cover (a track
 *   judge never sees another track — enforced here at assignment time and again
 *   in the backend at read time).
 * - **Batch** slices projects into contiguous chunks and hands one chunk per
 *   judge; used when an organizer wants deterministic, human-legible batches.
 *
 * The assignment strategy is documented and defended in JUDGING.md.
 */

export interface AssignableJudge {
  id: string;
  tracks: string[]; // track ids this judge may review; empty = all tracks
}

export interface AssignableProject {
  id: string;
  trackId: string | null;
}

export interface AssignmentPair {
  judgeId: string;
  projectId: string;
  batch: number;
}

function eligible(judge: AssignableJudge, project: AssignableProject): boolean {
  if (judge.tracks.length === 0) return true; // generalist judge
  if (!project.trackId) return true; // untracked project is open to any judge
  return judge.tracks.includes(project.trackId);
}

/**
 * Round-robin with track eligibility and even load.
 *
 * For each project we pick the `reviewsPerProject` eligible judges currently
 * carrying the least load, breaking ties by judge id for determinism. This
 * guarantees every project reaches its review target where enough eligible
 * judges exist, and spreads work evenly rather than dumping it on the first
 * judge in the list.
 */
export function roundRobin(
  judges: AssignableJudge[],
  projects: AssignableProject[],
  reviewsPerProject: number
): AssignmentPair[] {
  const load = new Map<string, number>(judges.map((j) => [j.id, 0]));
  const pairs: AssignmentPair[] = [];

  for (const project of projects) {
    const pool = judges
      .filter((j) => eligible(j, project))
      .sort((a, b) => {
        const la = load.get(a.id) ?? 0;
        const lb = load.get(b.id) ?? 0;
        return la - lb || a.id.localeCompare(b.id);
      });

    const take = Math.min(reviewsPerProject, pool.length);
    for (let i = 0; i < take; i++) {
      const judge = pool[i];
      if (!judge) break;
      pairs.push({ judgeId: judge.id, projectId: project.id, batch: 1 });
      load.set(judge.id, (load.get(judge.id) ?? 0) + 1);
    }
  }

  return pairs;
}

/**
 * Contiguous batches: split the eligible project list per judge into equal
 * chunks. Simpler and fully deterministic; useful when an organizer wants to
 * say "judge A takes projects 1–10".
 */
export function batched(
  judges: AssignableJudge[],
  projects: AssignableProject[]
): AssignmentPair[] {
  const pairs: AssignmentPair[] = [];
  if (judges.length === 0) return pairs;

  const perJudge = Math.ceil(projects.length / judges.length);
  judges.forEach((judge, ji) => {
    const slice = projects.slice(ji * perJudge, (ji + 1) * perJudge);
    for (const project of slice) {
      if (eligible(judge, project)) {
        pairs.push({ judgeId: judge.id, projectId: project.id, batch: ji + 1 });
      }
    }
  });

  return pairs;
}
