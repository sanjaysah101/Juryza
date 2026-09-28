import { describe, expect, test } from "bun:test";

import { nextPair } from "@/lib/pairing";

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

describe("nextPair", () => {
  test("never repeats a pair the judge has seen, and returns null when exhausted", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const history: { winnerId: string; loserId: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const pair = nextPair(ids, history, new Map());
      expect(pair).not.toBeNull();
      const [x, y] = pair as [string, string];
      expect(x).not.toBe(y);
      expect(seen.has(pairKey(x, y))).toBe(false);
      seen.add(pairKey(x, y));
      history.push({ winnerId: x, loserId: y });
    }
    expect(seen.size).toBe(10);
    expect(nextPair(ids, history, new Map())).toBeNull();
  });

  test("returns the only unseen pair", () => {
    const history = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "c", loserId: "a" },
    ];
    const pair = nextPair(["a", "b", "c"], history, new Map());
    expect(pair && pairKey(pair[0], pair[1])).toBe(pairKey("b", "c"));
  });

  test("needs at least two projects", () => {
    expect(nextPair([], [], new Map())).toBeNull();
    expect(nextPair(["a"], [], new Map())).toBeNull();
  });

  test("prefers the closest strengths among equally exposed projects", () => {
    const strengths = new Map([
      ["a", 4],
      ["b", 1],
      ["c", 3.8],
    ]);
    const pair = nextPair(["a", "b", "c"], [], strengths);
    expect(pair && pairKey(pair[0], pair[1])).toBe(pairKey("a", "c"));
  });

  test("prefers projects the judge has compared least", () => {
    const history = [{ winnerId: "a", loserId: "b" }];
    const pair = nextPair(["a", "b", "c", "d"], history, new Map());
    expect(pair && pairKey(pair[0], pair[1])).toBe(pairKey("c", "d"));
  });
});
