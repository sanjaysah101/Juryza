import { describe, expect, test } from "bun:test";

import { creditsSpent, maxVotesFor, seededShuffle, tally, voteCost } from "@/lib/voting";

describe("quadratic costs", () => {
  test("voteCost is votes squared", () => {
    expect([0, 1, 2, 3, 4].map(voteCost)).toEqual([0, 1, 4, 9, 16]);
  });

  test("creditsSpent sums the squares", () => {
    expect(creditsSpent([])).toBe(0);
    expect(creditsSpent([{ votes: 3 }, { votes: 2 }, { votes: 1 }])).toBe(14);
  });

  test("maxVotesFor is the largest affordable allocation on one project", () => {
    expect(maxVotesFor(16)).toBe(4);
    expect(maxVotesFor(15)).toBe(3);
    expect(maxVotesFor(1)).toBe(1);
    expect(maxVotesFor(0)).toBe(0);
    expect(maxVotesFor(-4)).toBe(0);
    for (const budget of [1, 7, 16, 99, 400])
      expect(voteCost(maxVotesFor(budget))).toBeLessThanOrEqual(budget);
  });
});

describe("tally", () => {
  test("sums votes and counts voters per project, most votes first", () => {
    const out = tally([
      { projectId: "a", voterKey: "u1", votes: 2 },
      { projectId: "b", voterKey: "u1", votes: 3 },
      { projectId: "a", voterKey: "u2", votes: 1 },
      { projectId: "c", voterKey: "u3", votes: 3 },
      { projectId: "c", voterKey: "u4", votes: 1 },
    ]);
    expect(out).toEqual([
      { projectId: "c", voters: 2, votes: 4 },
      { projectId: "a", voters: 2, votes: 3 },
      { projectId: "b", voters: 1, votes: 3 },
    ]);
  });
});

describe("seededShuffle", () => {
  const items = Array.from({ length: 30 }, (_, i) => `p${i}`);

  test("is stable for the same seed", () => {
    expect(seededShuffle(items, "user:alice")).toEqual(seededShuffle(items, "user:alice"));
  });

  test("is a permutation and does not mutate the input", () => {
    const copy = [...items];
    const out = seededShuffle(items, "user:bob");
    expect(items).toEqual(copy);
    expect([...out].sort()).toEqual([...items].sort());
  });

  test("differs between voters", () => {
    const orders = new Set(
      ["a", "b", "c", "d", "e"].map((seed) => seededShuffle(items, seed).join(","))
    );
    expect(orders.size).toBeGreaterThan(1);
    expect(seededShuffle(items, "user:alice")).not.toEqual(items);
  });

  test("handles empty and single-item lists", () => {
    expect(seededShuffle([], "x")).toEqual([]);
    expect(seededShuffle(["only"], "x")).toEqual(["only"]);
  });
});
