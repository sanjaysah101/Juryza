import { describe, expect, test } from "bun:test";

import {
  type AssignableJudge,
  type AssignableProject,
  type AssignmentPair,
  balanced,
  batched,
  coverage,
  eligible,
} from "@/lib/assignment";

const judges = (n: number, extra: Partial<AssignableJudge> = {}): AssignableJudge[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `j${String(i + 1).padStart(2, "0")}`,
    tracks: [],
    ...extra,
  }));
const projects = (n: number, trackId: string | null = null): AssignableProject[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i + 1).padStart(2, "0")}${trackId ? `-${trackId}` : ""}`,
    trackId,
  }));

const reviewsOf = (pairs: { projectId: string }[]) => {
  const m = new Map<string, number>();
  for (const p of pairs) m.set(p.projectId, (m.get(p.projectId) ?? 0) + 1);
  return m;
};
const loadOf = (pairs: { judgeId: string }[]) => {
  const m = new Map<string, number>();
  for (const p of pairs) m.set(p.judgeId, (m.get(p.judgeId) ?? 0) + 1);
  return m;
};
const key = (p: { judgeId: string; projectId: string }) => `${p.judgeId}|${p.projectId}`;

describe("eligible", () => {
  test("respects tracks and conflicts", () => {
    expect(eligible({ id: "j", tracks: [] }, { id: "p", trackId: "t1" })).toBe(true);
    expect(eligible({ id: "j", tracks: ["t1"] }, { id: "p", trackId: "t1" })).toBe(true);
    expect(eligible({ id: "j", tracks: ["t1"] }, { id: "p", trackId: "t2" })).toBe(false);
    expect(eligible({ id: "j", tracks: ["t1"] }, { id: "p", trackId: null })).toBe(true);
    expect(
      eligible({ id: "j", tracks: [], conflicts: new Set(["p"]) }, { id: "p", trackId: null })
    ).toBe(false);
  });
});

describe("balanced", () => {
  test("every project reaches the target when there are enough judges", () => {
    const ps = projects(20);
    const pairs = balanced(judges(7), ps, 3);
    const reviews = reviewsOf(pairs);
    for (const p of ps) expect(reviews.get(p.id)).toBe(3);
    expect(new Set(pairs.map(key)).size).toBe(pairs.length); // no judge reviews a project twice
  });

  test("load is balanced within one review", () => {
    const loads = [...loadOf(balanced(judges(7), projects(20), 3)).values()];
    expect(loads).toHaveLength(7);
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  test("never assigns across tracks a judge is limited to", () => {
    const js = [
      ...judges(3, { tracks: ["t1"] }),
      { id: "k1", tracks: ["t2"] },
      { id: "k2", tracks: ["t2"] },
      { id: "k3", tracks: ["t2"] },
    ];
    const ps = [...projects(6, "t1"), ...projects(6, "t2")];
    const pairs = balanced(js, ps, 2);
    const trackOf = new Map(ps.map((p) => [p.id, p.trackId]));
    const tracksOf = new Map(js.map((j) => [j.id, j.tracks]));
    for (const pair of pairs)
      expect(tracksOf.get(pair.judgeId)).toContain(trackOf.get(pair.projectId) as string);
    for (const p of ps) expect(reviewsOf(pairs).get(p.id)).toBe(2);
  });

  test("conflicts of interest are never assigned, even when that starves a project", () => {
    const js = judges(3);
    const conflicted = js.map((j, i) => (i < 2 ? { ...j, conflicts: new Set(["p01"]) } : j));
    const pairs = balanced(conflicted, projects(4), 2);
    const onP1 = pairs.filter((p) => p.projectId === "p01").map((p) => p.judgeId);
    expect(onP1).toEqual(["j03"]);
    expect(coverage(projects(4), pairs, 2).underCovered).toEqual(["p01"]);
  });

  test("is idempotent: re-running with existing assignments adds nothing", () => {
    const js = judges(5);
    const ps = projects(12);
    const first = balanced(js, ps, 3);
    expect(balanced(js, ps, 3, first)).toEqual([]);
  });

  test("tops up partial coverage without duplicating existing pairs", () => {
    const js = judges(5);
    const ps = projects(12);
    const existing = balanced(js, ps, 1);
    const extra = balanced(js, ps, 3, existing);
    const all = [...existing, ...extra];
    expect(new Set(all.map(key)).size).toBe(all.length);
    for (const p of ps) expect(reviewsOf(all).get(p.id)).toBe(3);
    const loads = [...loadOf(all).values()];
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(1);
  });

  test("is deterministic", () => {
    expect(balanced(judges(4), projects(9), 2)).toEqual(balanced(judges(4), projects(9), 2));
  });
});

describe("batched", () => {
  test("splits projects into contiguous chunks, one review each", () => {
    const pairs = batched(judges(3), projects(10));
    expect(pairs).toHaveLength(10);
    const byJudge = (id: string) => pairs.filter((p) => p.judgeId === id).map((p) => p.projectId);
    expect(byJudge("j01")).toEqual(["p01", "p02", "p03", "p04"]);
    expect(byJudge("j02")).toEqual(["p05", "p06", "p07", "p08"]);
    expect(byJudge("j03")).toEqual(["p09", "p10"]);
    expect(new Set(pairs.map((p: AssignmentPair) => p.batch))).toEqual(new Set([1, 2, 3]));
  });

  test("skips ineligible pairs and handles no judges", () => {
    const js = [{ id: "j", tracks: ["t1"] }];
    expect(
      batched(js, [...projects(2, "t1"), ...projects(2, "t2")]).map((p) => p.projectId)
    ).toEqual(["p01-t1", "p02-t1"]);
    expect(batched([], projects(3))).toEqual([]);
  });
});

describe("coverage", () => {
  test("counts fully and under-covered projects", () => {
    const ps = projects(3);
    const c = coverage(ps, [{ projectId: "p01" }, { projectId: "p01" }, { projectId: "p02" }], 2);
    expect(c).toEqual({ projects: 3, fullyCovered: 1, underCovered: ["p02", "p03"] });
  });
});
