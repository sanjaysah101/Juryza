/**
 * Community voting tally (T3), with quadratic voting.
 *
 * One-person-one-vote is trivially gameable by a loud minority, so Juryza
 * supports **quadratic voting**: a voter spends `credits` on a project, and the
 * influence that converts to is `sqrt(credits)`. Spending 9 credits on one
 * project buys 3 units of influence, not 9 — so concentrating force gets
 * expensive fast, which is the point. A plain 1-credit vote is `sqrt(1) = 1`,
 * so simple up-votes still behave intuitively.
 *
 * Documented in JUDGING.md alongside the anti-abuse measures (rate limits,
 * duplicate detection via a unique (project, voter) key, and the audit trail).
 */

export interface VoteRow {
  projectId: string;
  voterKey: string;
  credits: number;
}

export interface VoteTally {
  projectId: string;
  voters: number;
  influence: number;
}

export function tallyQuadratic(rows: VoteRow[]): VoteTally[] {
  const byProject = new Map<string, { voters: number; influence: number }>();
  for (const r of rows) {
    const agg = byProject.get(r.projectId) ?? { voters: 0, influence: 0 };
    agg.voters += 1;
    agg.influence += Math.sqrt(Math.max(0, r.credits));
    byProject.set(r.projectId, agg);
  }
  const out: VoteTally[] = [];
  for (const [projectId, agg] of byProject) {
    out.push({ projectId, voters: agg.voters, influence: agg.influence });
  }
  out.sort((a, b) => b.influence - a.influence);
  return out;
}

/** Whether the voting window is currently open for an event. */
export function votingOpen(e: { votingOpen: Date | null; votingClose: Date | null }): boolean {
  const now = Date.now();
  const opensOk = !e.votingOpen || now >= e.votingOpen.getTime();
  const closesOk = !e.votingClose || now < e.votingClose.getTime();
  return opensOk && closesOk;
}

/** Deterministic shuffle (seeded) so ballot order is randomized but stable per
 * voter — kills position bias without reshuffling on every poll. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}
