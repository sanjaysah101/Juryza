/**
 * Automatic project comparison: how alike are two submissions?
 *
 * Each project is turned into a bag of words (title, tagline, write-up, tech
 * tags), weighted by TF-IDF across the event so common words ("app", "the")
 * count for little and distinctive ones count for a lot, and compared by cosine
 * similarity. Identical repository URLs or titles are flagged outright.
 *
 * Organizers use it to catch duplicate or recycled submissions; everyone uses it
 * for "similar projects" and head-to-head comparison. Pure, dependency-free and
 * deterministic — it runs offline, with no model or external API.
 */

export interface ComparableProject {
  id: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  techTags?: string[] | null;
  repoUrl?: string | null;
}

export interface SimilarPair {
  a: string;
  b: string;
  score: number;
  reasons: string[];
  sharedTerms: string[];
}

const STOP = new Set(
  "a an and are as at be but by for from has have in into is it its of on or our that the their this to we with you your app project built using use uses can will".split(
    " "
  )
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function documentOf(p: ComparableProject): string[] {
  const tags = (p.techTags ?? []).flatMap((t) => [t, t]); // tags are strong signals
  // Title words count double: two teams rarely share distinctive title words by accident.
  return [
    ...tokenize(p.title),
    ...tokenize(p.title),
    ...tokenize(p.tagline ?? ""),
    ...tokenize(p.description ?? ""),
    ...tags.map((t) => t.toLowerCase()),
  ];
}

const normUrl = (u?: string | null) =>
  (u ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

export function buildVectors(projects: ComparableProject[]) {
  const docs = projects.map(documentOf);
  const df = new Map<string, number>();
  for (const doc of docs) for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  const n = projects.length;
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log((n + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      vec.set(term, count * idf);
    }
    return vec;
  });
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w) dot += v * w;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function topShared(a: Map<string, number>, b: Map<string, number>, k = 5): string[] {
  return [...a.keys()]
    .filter((t) => b.has(t))
    .sort((x, y) => (b.get(y) ?? 0) * (a.get(y) ?? 0) - (b.get(x) ?? 0) * (a.get(x) ?? 0))
    .slice(0, k);
}

/** Every pair scoring at least `threshold`, most similar first. */
export function similarPairs(projects: ComparableProject[], threshold = 0.5): SimilarPair[] {
  const vecs = buildVectors(projects);
  const out: SimilarPair[] = [];
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const pi = projects[i] as ComparableProject;
      const pj = projects[j] as ComparableProject;
      const vi = vecs[i] as Map<string, number>;
      const vj = vecs[j] as Map<string, number>;
      const reasons: string[] = [];
      let score = cosine(vi, vj);
      const repoA = normUrl(pi.repoUrl);
      if (repoA && repoA === normUrl(pj.repoUrl)) {
        reasons.push("Same repository URL");
        score = Math.max(score, 1);
      }
      if (pi.title.trim().toLowerCase() === pj.title.trim().toLowerCase()) {
        reasons.push("Identical title");
        score = Math.max(score, 0.95);
      }
      if (score >= threshold) {
        if (reasons.length === 0) reasons.push("Overlapping description and tags");
        out.push({
          a: pi.id,
          b: pj.id,
          score: Math.min(1, score),
          reasons,
          sharedTerms: topShared(vi, vj),
        });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

/** The `k` projects most similar to `targetId`. */
export function nearest(projects: ComparableProject[], targetId: string, k = 4) {
  const idx = projects.findIndex((p) => p.id === targetId);
  if (idx < 0) return [];
  const vecs = buildVectors(projects);
  const target = vecs[idx] as Map<string, number>;
  return projects
    .map((p, i) => ({
      id: p.id,
      score: i === idx ? -1 : cosine(target, vecs[i] as Map<string, number>),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
