import type { RubricCriterion, Score } from "@/lib/db";

/**
 * Scoring and cross-judge normalization.
 *
 * Everything here is pure and deterministic so it can be unit-tested and so the
 * numbers a judge sees, the CSV export, and the results page all agree. Nothing
 * is stored pre-aggregated: re-weighting the rubric or a late score edit is
 * always reflected because the aggregate is computed on read.
 *
 * The maths is documented in full in JUDGING.md. In brief:
 *
 * - A **raw score** for one (judge, project) is the weighted mean of that
 *   judge's per-criterion marks, weights normalized to sum to 1.
 * - **Normalization** corrects for judges who run hot or cold. For each judge we
 *   compute the mean and standard deviation of their raw scores, convert each of
 *   their scores to a z-score, then map the z-scores back onto the 1–5 scale
 *   using the global mean and a fixed spread. A judge who marks everything a 3
 *   (zero variance) contributes no signal, so their scores collapse to the
 *   global mean rather than blowing up a divide-by-zero.
 * - A **project's final score** is the mean of its normalized scores.
 */

export interface WeightedCriterion {
  key: string;
  weight: number;
}

/** Weighted mean of one score's criteria marks. Missing marks are skipped. */
export function rawScore(criteria: Record<string, number>, rubric: WeightedCriterion[]): number {
  let weightSum = 0;
  let acc = 0;
  for (const c of rubric) {
    const mark = criteria[c.key];
    if (typeof mark === "number" && !Number.isNaN(mark)) {
      acc += mark * c.weight;
      weightSum += c.weight;
    }
  }
  if (weightSum === 0) return 0;
  return acc / weightSum;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

export interface ScoreRow {
  judgeId: string;
  projectId: string;
  raw: number;
}

export interface NormalizedRow extends ScoreRow {
  z: number;
  normalized: number;
}

/**
 * The global scale the normalized scores are mapped back onto. Using the global
 * mean as the centre and a fixed spread keeps normalized scores on the familiar
 * 1–5 scale and comparable across events. TARGET_SD of 0.9 is roughly the raw
 * spread seen in the fixture data (documented in JUDGING.md).
 */
const TARGET_SD = 0.9;

export function normalizeScores(rows: ScoreRow[]): NormalizedRow[] {
  const globalMean = mean(rows.map((r) => r.raw));

  // Group by judge to get each judge's own mean and spread.
  const byJudge = new Map<string, ScoreRow[]>();
  for (const r of rows) {
    const list = byJudge.get(r.judgeId) ?? [];
    list.push(r);
    byJudge.set(r.judgeId, list);
  }

  const judgeStats = new Map<string, { mu: number; sd: number }>();
  for (const [judgeId, list] of byJudge) {
    const mu = mean(list.map((r) => r.raw));
    const sd = stddev(
      list.map((r) => r.raw),
      mu
    );
    judgeStats.set(judgeId, { mu, sd });
  }

  return rows.map((r) => {
    const { mu, sd } = judgeStats.get(r.judgeId) ?? { mu: r.raw, sd: 0 };
    // A judge with no spread (marked everything the same) carries no comparative
    // signal: z collapses to 0 and their score becomes the global mean.
    const z = sd > 0 ? (r.raw - mu) / sd : 0;
    const normalized = clamp(globalMean + z * TARGET_SD, 1, 5);
    return { ...r, z, normalized };
  });
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export interface ProjectResult {
  projectId: string;
  reviews: number;
  rawMean: number;
  normalizedMean: number;
}

/** Aggregate per-(judge,project) rows into a per-project result. */
export function aggregateByProject(normalized: NormalizedRow[]): ProjectResult[] {
  const byProject = new Map<string, NormalizedRow[]>();
  for (const r of normalized) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r);
    byProject.set(r.projectId, list);
  }

  const out: ProjectResult[] = [];
  for (const [projectId, list] of byProject) {
    out.push({
      projectId,
      reviews: list.length,
      rawMean: mean(list.map((r) => r.raw)),
      normalizedMean: mean(list.map((r) => r.normalized)),
    });
  }
  // Highest normalized score first.
  out.sort((a, b) => b.normalizedMean - a.normalizedMean);
  return out;
}

/** Convenience: build the raw rows from DB score records + rubric. */
export function toScoreRows(
  scores: Pick<Score, "judgeId" | "projectId" | "criteria">[],
  rubric: Pick<RubricCriterion, "key" | "weight">[]
): ScoreRow[] {
  return scores.map((s) => ({
    judgeId: s.judgeId,
    projectId: s.projectId,
    raw: rawScore(s.criteria, rubric),
  }));
}
