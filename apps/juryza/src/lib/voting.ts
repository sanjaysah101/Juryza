/**
 * Community voting maths (T3): quadratic voting with a per-voter budget.
 *
 * Every voter gets `budget` credits for the whole event. Casting `v` votes on
 * one project costs `v²` credits, so a voter with 16 credits can give one
 * project 4 votes, or sixteen projects 1 vote each — but never pile 16 votes on
 * a friend. A project's tally is the plain sum of votes it received. That is
 * the whole mechanism: intensity of preference is expressible, concentration is
 * expensive. The budget is enforced by the server (see the votes route), not the
 * ballot UI.
 */

export const voteCost = (votes: number) => votes * votes;

/** The most votes one project can receive from a voter with `budget` credits. */
export const maxVotesFor = (budget: number) => Math.floor(Math.sqrt(Math.max(0, budget)));

/** Credits spent across a voter's allocations. */
export function creditsSpent(allocations: { votes: number }[]): number {
  return allocations.reduce((acc, a) => acc + voteCost(a.votes), 0);
}

export interface VoteRow {
  projectId: string;
  voterKey: string;
  votes: number;
}

export interface VoteTally {
  projectId: string;
  voters: number;
  votes: number;
}

export function tally(rows: VoteRow[]): VoteTally[] {
  const byProject = new Map<string, VoteTally>();
  for (const r of rows) {
    const agg = byProject.get(r.projectId) ?? { projectId: r.projectId, voters: 0, votes: 0 };
    agg.voters += 1;
    agg.votes += r.votes;
    byProject.set(r.projectId, agg);
  }
  return [...byProject.values()].sort((a, b) => b.votes - a.votes || b.voters - a.voters);
}

/**
 * Deterministic shuffle seeded by the voter, so a ballot's order is random
 * across voters (no position bias) yet stable for one voter between reloads.
 */
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
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}
