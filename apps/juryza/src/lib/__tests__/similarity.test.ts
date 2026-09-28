import { describe, expect, test } from "bun:test";

import { type ComparableProject, cosine, nearest, similarPairs, tokenize } from "@/lib/similarity";

const solar: ComparableProject = {
  id: "solar",
  title: "SunTrack",
  tagline: "Solar panel output forecasting",
  description:
    "Forecasts rooftop solar panel output from weather data and alerts homeowners about degradation.",
  techTags: ["python", "weather"],
  repoUrl: "https://github.com/team/suntrack",
};
const solar2: ComparableProject = {
  id: "solar2",
  title: "PanelCast",
  tagline: "Forecast rooftop solar output",
  description: "Weather-driven forecasting of rooftop solar panel output with degradation alerts.",
  techTags: ["python", "weather"],
};
const recipes: ComparableProject = {
  id: "recipes",
  title: "Pantry Chef",
  tagline: "Recipes from leftovers",
  description: "Suggests dinners from whatever ingredients remain in your fridge and pantry.",
  techTags: ["react"],
};
const music: ComparableProject = {
  id: "music",
  title: "Chord Buddy",
  tagline: "Guitar chord trainer",
  description: "Listens through the microphone and grades guitar chord changes in real time.",
  techTags: ["rust"],
};

describe("tokenize", () => {
  test("lowercases, drops stop words and short tokens", () => {
    expect(tokenize("The App is built using Next.js and a GPU")).toEqual(["next.js", "gpu"]);
  });
});

describe("similarPairs", () => {
  test("flags an identical title outright", () => {
    const pairs = similarPairs([recipes, { ...music, title: "pantry chef " }]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasons).toContain("Identical title");
    expect(pairs[0]?.score).toBeGreaterThanOrEqual(0.95);
  });

  test("flags the same repository, ignoring case, .git and trailing slashes", () => {
    const pairs = similarPairs([
      solar,
      { ...music, repoUrl: "https://GitHub.com/team/suntrack.git/" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.reasons).toContain("Same repository URL");
    expect(pairs[0]?.score).toBe(1);
  });

  test("unrelated projects stay below the threshold", () => {
    expect(similarPairs([solar, recipes, music])).toEqual([]);
  });

  test("near-duplicate write-ups are detected with shared terms", () => {
    const pairs = similarPairs([solar, solar2, recipes, music], 0.3);
    expect(pairs[0]).toMatchObject({ a: "solar", b: "solar2" });
    expect(pairs[0]?.reasons).toEqual(["Overlapping description and tags"]);
    expect(pairs[0]?.sharedTerms).toContain("solar");
  });
});

describe("nearest", () => {
  test("orders by similarity, excludes the target and zero matches", () => {
    const partly: ComparableProject = {
      id: "partly",
      title: "Weather Wall",
      tagline: "Weather forecast dashboard",
      techTags: ["python"],
    };
    const out = nearest([solar, recipes, solar2, music, partly], "solar", 4);
    expect(out.map((n) => n.id)).toEqual(["solar2", "partly"]);
    expect(out[0]?.score ?? 0).toBeGreaterThan(out[1]?.score ?? 0);
  });

  test("unknown target gives nothing", () => {
    expect(nearest([solar, solar2], "missing")).toEqual([]);
  });
});

describe("cosine", () => {
  test("is 1 for identical vectors and 0 for disjoint or empty ones", () => {
    const a = new Map([
      ["x", 1],
      ["y", 2],
    ]);
    expect(cosine(a, new Map(a))).toBeCloseTo(1, 12);
    expect(cosine(a, new Map([["z", 3]]))).toBe(0);
    expect(cosine(new Map(), a)).toBe(0);
  });
});
