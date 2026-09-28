/**
 * Judge → project assignment (T2). Pure functions returning (judge, project)
 * pairs, so a plan can be previewed and tested before anything is written.
 *
 * Rules every strategy honours:
 *  - **Track eligibility** — a judge limited to some tracks never gets a project
 *    from another track (and the backend re-checks this at scoring time).
 *  - **Conflicts of interest** — a judge is never assigned a project made by a
 *    team they belong to.
 *  - **Idempotence** — existing assignments count towards a project's target
 *    and a judge's load, so re-running tops up coverage instead of piling on.
 *
 * Strategies:
 *  - `balanced` (default): each project gets `reviewsPerProject` reviews, always
 *    from the eligible judges currently carrying the least work. Projects with
 *    the fewest eligible judges are placed first so they are not starved.
 *  - `batch`: contiguous, human-legible chunks ("judge A takes projects 1–10"),
 *    one review per project.
 */

export interface AssignableJudge {
  id: string;
  tracks: string[]; // empty = all tracks
  conflicts?: Set<string>; // project ids this judge must not review
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

export function eligible(judge: AssignableJudge, project: AssignableProject): boolean {
  if (judge.conflicts?.has(project.id)) return false;
  if (judge.tracks.length === 0 || !project.trackId) return true;
  return judge.tracks.includes(project.trackId);
}

export function balanced(
  judges: AssignableJudge[],
  projects: AssignableProject[],
  reviewsPerProject: number,
  existing: { judgeId: string; projectId: string }[] = []
): AssignmentPair[] {
  const load = new Map<string, number>(judges.map((j) => [j.id, 0]));
  const have = new Map<string, Set<string>>();
  for (const a of existing) {
    load.set(a.judgeId, (load.get(a.judgeId) ?? 0) + 1);
    have.set(a.projectId, (have.get(a.projectId) ?? new Set()).add(a.judgeId));
  }

  const pool = (p: AssignableProject) =>
    judges.filter((j) => eligible(j, p) && !have.get(p.id)?.has(j.id));
  const order = [...projects].sort(
    (a, b) => pool(a).length - pool(b).length || a.id.localeCompare(b.id)
  );

  const pairs: AssignmentPair[] = [];
  for (const project of order) {
    const need = reviewsPerProject - (have.get(project.id)?.size ?? 0);
    if (need <= 0) continue;
    const candidates = pool(project).sort(
      (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.id.localeCompare(b.id)
    );
    for (const judge of candidates.slice(0, need)) {
      pairs.push({ judgeId: judge.id, projectId: project.id, batch: 1 });
      load.set(judge.id, (load.get(judge.id) ?? 0) + 1);
    }
  }
  return pairs;
}

export function batched(
  judges: AssignableJudge[],
  projects: AssignableProject[]
): AssignmentPair[] {
  if (judges.length === 0) return [];
  const pairs: AssignmentPair[] = [];
  const perJudge = Math.ceil(projects.length / judges.length);
  judges.forEach((judge, ji) => {
    for (const project of projects.slice(ji * perJudge, (ji + 1) * perJudge)) {
      if (eligible(judge, project))
        pairs.push({ judgeId: judge.id, projectId: project.id, batch: ji + 1 });
    }
  });
  return pairs;
}

/** Coverage summary for a set of pairs — what the organizer sees before committing. */
export function coverage(
  projects: AssignableProject[],
  pairs: { projectId: string }[],
  target: number
) {
  const count = new Map<string, number>();
  for (const p of pairs) count.set(p.projectId, (count.get(p.projectId) ?? 0) + 1);
  const under = projects.filter((p) => (count.get(p.id) ?? 0) < target).map((p) => p.id);
  return {
    projects: projects.length,
    fullyCovered: projects.length - under.length,
    underCovered: under,
  };
}
