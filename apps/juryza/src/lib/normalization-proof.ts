/**
 * Normalization proof generator (Normalization Proof bonus).
 *
 * Run against the seeded database, this prints the raw scores, the normalized
 * scores, and the ranking change for the fixture data — the exact evidence the
 * bonus asks for. The output is pasted into JUDGING.md and regenerated with:
 *
 *   bun run src/lib/normalization-proof.ts
 *
 * It reuses the SAME `scoring.ts` functions the live endpoints use, so the proof
 * is not a separate re-implementation that could drift — it is the production
 * maths, shown its work.
 */

import { eq } from "drizzle-orm";

import { db, project, rubricCriterion, score } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { aggregateByProject, normalizeScores, toScoreRows } from "@/lib/scoring";

async function main() {
  const activeEvent = await getActiveEvent();
  if (!activeEvent) {
    console.error("No active event — seed first.");
    process.exit(1);
  }
  const eventId = activeEvent.id;

  const rubric = await db
    .select({
      key: rubricCriterion.key,
      weight: rubricCriterion.weight,
      label: rubricCriterion.label,
    })
    .from(rubricCriterion)
    .where(eq(rubricCriterion.eventId, eventId));

  const scores = await db
    .select({ judgeId: score.judgeId, projectId: score.projectId, criteria: score.criteria })
    .from(score)
    .where(eq(score.eventId, eventId));

  const projects = await db
    .select({ id: project.id, title: project.title })
    .from(project)
    .where(eq(project.eventId, eventId));
  const titleById = new Map(projects.map((p) => [p.id, p.title]));

  // Raw ranking (mean of raw weighted scores, no normalization).
  const rawRows = toScoreRows(scores, rubric);
  const rawByProject = new Map<string, number[]>();
  for (const r of rawRows) {
    const list = rawByProject.get(r.projectId) ?? [];
    list.push(r.raw);
    rawByProject.set(r.projectId, list);
  }
  const rawRanking = [...rawByProject.entries()]
    .map(([projectId, xs]) => ({ projectId, mean: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.mean - a.mean);
  const rawRank = new Map(rawRanking.map((r, i) => [r.projectId, i + 1]));

  // Normalized ranking.
  const normalized = normalizeScores(rawRows);
  const normRanking = aggregateByProject(normalized);
  const normRank = new Map(normRanking.map((r, i) => [r.projectId, i + 1]));

  // Per-judge spread, to show which judges ran hot/cold.
  const byJudge = new Map<string, number[]>();
  for (const r of rawRows) {
    const list = byJudge.get(r.judgeId) ?? [];
    list.push(r.raw);
    byJudge.set(r.judgeId, list);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };

  console.log("# Normalization proof — fixture data\n");
  console.log(`Event: ${activeEvent.name} (${eventId})`);
  console.log(`Rubric: ${rubric.map((c) => `${c.label}×${c.weight}`).join(", ")}`);
  console.log(
    `Scores: ${scores.length} across ${byJudge.size} judges, ${projects.length} projects\n`
  );

  console.log("## Per-judge raw spread (who ran hot/cold)\n");
  const judgeStats = [...byJudge.entries()]
    .map(([j, xs]) => ({ j, n: xs.length, mu: mean(xs), sd: sd(xs) }))
    .sort((a, b) => a.mu - b.mu);
  console.log("judge            n    mean    sd");
  for (const st of judgeStats.slice(0, 5)) {
    console.log(
      `${st.j.slice(0, 12).padEnd(14)} ${String(st.n).padStart(3)}  ${st.mu.toFixed(2)}  ${st.sd.toFixed(2)}`
    );
  }
  console.log("...");
  for (const st of judgeStats.slice(-2)) {
    console.log(
      `${st.j.slice(0, 12).padEnd(14)} ${String(st.n).padStart(3)}  ${st.mu.toFixed(2)}  ${st.sd.toFixed(2)}`
    );
  }

  console.log("\n## Ranking change (raw → normalized)\n");
  console.log("rank_norm  project                 raw_mean  norm_mean  Δrank");
  for (const r of normRanking.slice(0, 15)) {
    const title = (titleById.get(r.projectId) ?? r.projectId).slice(0, 20).padEnd(22);
    const nr = normRank.get(r.projectId) ?? 0;
    const rr = rawRank.get(r.projectId) ?? 0;
    const delta = rr - nr;
    const arrow = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "—";
    console.log(
      `${String(nr).padStart(4)}       ${title}  ${r.rawMean.toFixed(3)}     ${r.normalizedMean.toFixed(3)}      ${arrow} (was ${rr})`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
