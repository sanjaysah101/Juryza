/**
 * Normalization proof generator (bonus challenge).
 *
 * Prints, for the seeded fixture event, each judge's calibration (mean, spread,
 * flag), and the ranking before and after normalization — the evidence pasted
 * into JUDGING.md. It calls the same `computeResults` the leaderboard, CSV and
 * dashboard use, so the proof is the production maths showing its work:
 *
 *   bun run src/lib/normalization-proof.ts [event-slug]
 */

import { findEvent } from "@/lib/server/events";
import { computeResults } from "@/lib/server/results";

async function main() {
  const e = await findEvent(process.argv[2] ?? "sample-hack-2026");
  if (!e) throw new Error("Event not found — seed first");
  const r = await computeResults(e);

  console.log(`# Normalization proof — ${e.name}\n`);
  console.log(`Rubric: ${r.criteria.map((c) => `${c.label} ×${c.weight}`).join(", ")}`);
  console.log(
    `${r.totals.scores} scores from ${r.judges.length} judges across ${r.totals.submitted} projects\n`
  );

  console.log("## Judge calibration (sorted by mean)\n");
  console.log("| judge | n | mean | sd | offset | flag |\n|---|---:|---:|---:|---:|---|");
  for (const j of r.judges) {
    console.log(
      `| ${j.name} | ${j.count} | ${j.mean.toFixed(2)} | ${j.sd.toFixed(2)} | ${j.offset >= 0 ? "+" : ""}${j.offset.toFixed(2)} | ${j.flag ?? ""} |`
    );
  }

  console.log("\n## Ranking: raw mean vs normalized mean\n");
  console.log(
    "| rank | project | reviews | raw | normalized | raw rank | change |\n|---:|---|---:|---:|---:|---:|---|"
  );
  for (const p of r.projects.filter((x) => x.rank !== null)) {
    const delta = (p.rawRank ?? 0) - (p.rank ?? 0);
    const change = delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : "—";
    console.log(
      `| ${p.rank} | ${p.title} | ${p.reviews} | ${p.raw?.toFixed(3)} | ${p.normalized?.toFixed(3)} | ${p.rawRank} | ${change} |`
    );
  }
  const moved = r.projects.filter((p) => p.rank !== null && p.rank !== p.rawRank).length;
  console.log(
    `\n${moved} of ${r.projects.filter((p) => p.rank !== null).length} projects change rank under normalization.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
