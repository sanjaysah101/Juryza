/**
 * Active pair selection for pairwise judging.
 *
 * Random pairs waste a judge's attention: comparing the obvious winner with the
 * obvious loser tells the Bradley–Terry model almost nothing. We pick, among
 * the judge's assigned projects, the unseen pair that maximizes expected
 * information: prefer projects this judge has compared least (coverage), then
 * pairs whose current global strengths are closest (the outcome is least
 * predictable, so the answer moves the estimate most).
 *
 * Returns null when the judge has compared every pair of their projects.
 */
export function nextPair(
  projectIds: string[],
  judgeHistory: { winnerId: string; loserId: string }[],
  strengths: Map<string, number>
): [string, string] | null {
  const seen = new Set(judgeHistory.map((c) => [c.winnerId, c.loserId].sort().join("|")));
  const exposure = new Map<string, number>();
  for (const c of judgeHistory) {
    exposure.set(c.winnerId, (exposure.get(c.winnerId) ?? 0) + 1);
    exposure.set(c.loserId, (exposure.get(c.loserId) ?? 0) + 1);
  }

  let best: [string, string] | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < projectIds.length; i++) {
    for (let j = i + 1; j < projectIds.length; j++) {
      const a = projectIds[i] as string;
      const b = projectIds[j] as string;
      if (seen.has([a, b].sort().join("|"))) continue;
      const gap = Math.abs(Math.log(strengths.get(a) ?? 1) - Math.log(strengths.get(b) ?? 1));
      const cost = ((exposure.get(a) ?? 0) + (exposure.get(b) ?? 0)) * 10 + gap;
      if (cost < bestCost) {
        bestCost = cost;
        best = [a, b];
      }
    }
  }
  // Randomize left/right so position carries no signal.
  if (best && Math.random() < 0.5) best = [best[1], best[0]];
  return best;
}
