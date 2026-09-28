import { describe, expect, test } from "bun:test";

import { bradleyTerry, type Comparison } from "@/lib/bradley-terry";

const games = (winnerId: string, loserId: string, n = 1): Comparison[] =>
  Array.from({ length: n }, () => ({ winnerId, loserId }));

describe("bradleyTerry", () => {
  test("no comparisons gives no scores", () => {
    expect(bradleyTerry([])).toEqual([]);
  });

  test("a clear winner ranks first and the order follows the evidence", () => {
    const out = bradleyTerry([
      ...games("a", "b", 4),
      ...games("b", "c", 4),
      ...games("a", "c", 4),
      ...games("b", "a", 1),
    ]);
    expect(out.map((s) => s.projectId)).toEqual(["a", "b", "c"]);
    expect(out[0]?.scaled).toBe(5);
    expect(out[2]?.scaled).toBe(1);
    expect(out[0]).toMatchObject({ wins: 8, losses: 1, comparisons: 9 });
  });

  test("symmetric results give (near-)equal strengths", () => {
    const out = bradleyTerry([
      ...games("a", "b", 3),
      ...games("b", "a", 3),
      ...games("b", "c", 3),
      ...games("c", "b", 3),
    ]);
    const strengths = out.map((s) => s.strength);
    expect(Math.max(...strengths) / Math.min(...strengths)).toBeLessThan(1.05);
  });

  test("one-sided wins stay finite (no NaN or Infinity)", () => {
    const out = bradleyTerry(games("a", "b", 10));
    expect(out).toHaveLength(2);
    for (const s of out) {
      expect(Number.isFinite(s.strength)).toBe(true);
      expect(Number.isFinite(s.scaled)).toBe(true);
      expect(s.strength).toBeGreaterThan(0);
    }
    expect(out[0]?.projectId).toBe("a");
  });

  test("strengths are normalized to a geometric mean of 1", () => {
    const out = bradleyTerry([...games("a", "b", 2), ...games("b", "c", 2), ...games("c", "a", 1)]);
    const logMean = out.reduce((acc, s) => acc + Math.log(s.strength), 0) / out.length;
    expect(logMean).toBeCloseTo(0, 8);
  });
});
