/**
 * Bradley–Terry estimator for pairwise judging (T2 "Pairwise Mode" bonus).
 *
 * Instead of asking a judge for an absolute 1–5 score, pairwise mode shows two
 * projects and asks which is better. This sidesteps cross-judge calibration
 * entirely — there is no "hot" or "cold" judge when everyone only ever says
 * "A beats B". From the collected comparisons we recover a single global
 * strength per project with the Bradley–Terry model.
 *
 * The model: each project i has a latent strength `s_i`, and
 *   P(i beats j) = s_i / (s_i + s_j).
 * We fit the strengths by maximum likelihood using the classic MM
 * (minorization–maximization) iteration of Hunter (2004), which is simple,
 * dependency-free, and provably convergent:
 *
 *   s_i ← W_i / Σ_j ( n_ij / (s_i + s_j) )
 *
 * where W_i is i's total wins and n_ij is the number of times i and j were
 * compared. A tiny virtual win/loss against a phantom average opponent keeps a
 * project that only ever won (or only ever lost) from diverging to ±∞ — the
 * standard regularization. Documented in JUDGING.md.
 */

export interface Comparison {
  winnerId: string;
  loserId: string;
}

export interface BТScore {
  projectId: string;
  strength: number;
  /** Strength normalized to a 1–5 scale for display next to rubric scores. */
  scaled: number;
  wins: number;
  losses: number;
  comparisons: number;
}

export function bradleyTerry(
  comparisons: Comparison[],
  opts: { iterations?: number; prior?: number } = {}
): BТScore[] {
  const iterations = opts.iterations ?? 100;
  // Regularization: a small number of virtual games against a strength-1 anchor.
  const prior = opts.prior ?? 0.5;

  // Collect the set of projects and pairwise counts.
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  // n[i][j] = number of comparisons between i and j (symmetric).
  const pairCount = new Map<string, Map<string, number>>();
  const ids = new Set<string>();

  const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
  const pair = (a: string, b: string) => {
    const row = pairCount.get(a) ?? new Map<string, number>();
    row.set(b, (row.get(b) ?? 0) + 1);
    pairCount.set(a, row);
  };

  for (const c of comparisons) {
    ids.add(c.winnerId);
    ids.add(c.loserId);
    bump(wins, c.winnerId);
    bump(losses, c.loserId);
    pair(c.winnerId, c.loserId);
    pair(c.loserId, c.winnerId);
  }

  const projects = [...ids];
  if (projects.length === 0) return [];

  // Initialize all strengths to 1.
  const s = new Map<string, number>(projects.map((p) => [p, 1]));
  // Local accessor with a safe default — every id is in `s` by construction, so
  // this never actually falls back, but it keeps the code assertion-free.
  const strengthOf = (p: string): number => s.get(p) ?? 1;

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map<string, number>();
    for (const i of projects) {
      const wi = (wins.get(i) ?? 0) + prior; // + virtual wins
      let denom = prior / (strengthOf(i) + 1); // virtual games vs anchor of strength 1
      const row = pairCount.get(i);
      if (row) {
        for (const [j, nij] of row) {
          denom += nij / (strengthOf(i) + strengthOf(j));
        }
      }
      next.set(i, denom > 0 ? wi / denom : strengthOf(i));
    }
    // Normalize so the geometric mean is 1 (keeps numbers stable across iters).
    const logSum = projects.reduce((acc, p) => acc + Math.log(next.get(p) ?? 1), 0);
    const geoMean = Math.exp(logSum / projects.length);
    for (const p of projects) s.set(p, (next.get(p) ?? 1) / geoMean);
  }

  // Map strengths onto a 1–5 display scale, so the spread is legible next to
  // rubric scores. Highest strength → 5.
  const sorted = [...projects].sort((a, b) => strengthOf(b) - strengthOf(a));
  const strengths = sorted.map((p) => strengthOf(p));
  const maxS = Math.max(...strengths);
  const minS = Math.min(...strengths);
  const span = maxS - minS || 1;

  return sorted.map((projectId) => {
    const strength = strengthOf(projectId);
    const scaled = 1 + (4 * (strength - minS)) / span;
    return {
      projectId,
      strength,
      scaled,
      wins: wins.get(projectId) ?? 0,
      losses: losses.get(projectId) ?? 0,
      comparisons: (wins.get(projectId) ?? 0) + (losses.get(projectId) ?? 0),
    };
  });
}
