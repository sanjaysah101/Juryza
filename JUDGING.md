# JUDGING.md — assignment, scoring, normalization

This document explains, and defends, the judging maths in Juryza. It is the
counterpart to the code in `apps/juryza/src/lib/{scoring,assignment,bradley-terry}.ts`
and the endpoints under `apps/juryza/src/app/api/judge` and `.../organizer`.

## 1. Judge assignment

Two strategies, both pure functions (`lib/assignment.ts`) so they can be tested
and previewed before anything is written:

- **Round-robin (default).** For each project we pick the `reviewsPerProject`
  eligible judges currently carrying the least load, breaking ties by judge id.
  This guarantees every project reaches its review target where enough eligible
  judges exist, and spreads work evenly rather than dumping it on the first judge
  in the list.
- **Batch.** Contiguous chunks of the project list, one per judge — deterministic
  and human-legible ("judge A takes 1–10").

**Track eligibility is enforced at assignment time and again at read time.** A
judge only reviews tracks they cover (`judge_tracks`); a project in another track
is never offered to them, and even if an assignment row somehow existed, the
scores endpoint is scoped to `assignment.judgeId = caller`. "A track judge must
never see another track" holds in the backend, not the UI.

## 2. Scoring

Each score is a set of per-criterion marks (1–5) keyed by criterion. The rubric
is **organizer-configurable and weighted** — the differentiator the spec calls
out, since the market leader cannot weight criteria at all.

A single score's **raw value** is the weighted mean of its marks, with weights
normalized to sum to 1 at compute time (`rawScore` in `lib/scoring.ts`):

```
raw = Σ_c (mark_c · weight_c) / Σ_c weight_c   (over criteria the judge filled in)
```

Nothing is stored pre-aggregated. Re-weighting the rubric or a late edit is
always reflected because every aggregate is computed on read.

## 3. Cross-judge normalization (z-score)

Judges run hot and cold. One marks everything a 3; another spreads 1–5. Averaging
raw scores lets a project's rank depend on *which* judges happened to draw it.
Juryza corrects for this with **per-judge z-score normalization**, then maps back
onto the familiar 1–5 scale.

For each judge *j* we compute the mean `μ_j` and standard deviation `σ_j` of that
judge's raw scores. Each score is converted to a z-score and rescaled:

```
z          = (raw − μ_j) / σ_j          (σ_j > 0)
normalized = clamp( globalMean + z · TARGET_SD , 1, 5 )
```

- `globalMean` is the mean raw score across all scores — the shared centre.
- `TARGET_SD = 0.9`, roughly the raw spread in the fixture data, so normalized
  scores keep a natural 1–5 range.
- **A judge with zero variance** (marked everything the same) carries no
  comparative signal, so `z = 0` and their scores collapse to the global mean
  rather than dividing by zero. This is the deliberate, defended treatment of the
  "judge who marked everything a 3" case in the fixtures.

A project's final score is the mean of its **normalized** scores.

### Why z-score, and its limits

Z-score normalization is the simplest method that (a) removes a judge's additive
bias (`μ_j`) and (b) removes their scale bias (`σ_j`), which are the two ways
judges systematically differ. It assumes each judge reviewed a roughly
representative slice of projects — true under round-robin assignment. It does
**not** model project difficulty or judge–project interaction; for that, use the
pairwise mode below, which sidesteps calibration entirely. We show both and let
an organizer choose.

## 4. Normalization proof (fixture data)

Regenerate with `bun run apps/juryza/src/lib/normalization-proof.ts` against the
seeded database. It reuses the **same** `scoring.ts` functions the live endpoints
use, so the proof is the production maths showing its work — not a separate
re-implementation that could drift.

Fixture run (Sample Hack 2026: 132 scores, 32 judges, 41 projects; rubric
Functionality×0.4, Code Quality×0.35, Innovation×0.25):

Per-judge raw spread — judges genuinely differ:

```
judge          n   mean   sd
(coldest)      1   2.00   0.00
               2   2.98   0.48
               3   3.05   0.65
...
               4   4.11   0.50
(hottest)      6   4.25   0.71
```

Ranking change, raw → normalized (Δrank = raw rank − normalized rank):

```
rank  project          raw_mean  norm_mean  Δrank
  1   Iron Switch        4.350     4.672     —  (was 1)
  2   Slow Trail         4.083     4.487     ▲4 (was 6)
  3   Still Beacon       4.250     4.362     —  (was 3)
  4   Salt Kiln          4.067     4.356     ▲3 (was 7)
  5   Salt Ledger        4.338     4.318     ▼3 (was 2)
  6   Salt Loom          4.088     4.238     ▼1 (was 5)
  7   Dry Relay          4.117     4.131     ▼3 (was 4)
  8   Dry Harbour        3.862     4.011     ▲2 (was 10)
  9   Glass Signal       3.525     3.791     ▲10 (was 19)
 10   Copper Kiln        3.933     3.788     ▼2 (was 8)
 ...  (one project moves ▲18: 31 → 13)
```

**Reading it:** projects reviewed mostly by cold judges climb after
normalization (Glass Signal ▲10; another ▲18), and projects that rode a couple of
generous judges fall (Salt Ledger ▼3). The raw σ across judges is ~0.9; after
normalization the between-judge component of the spread is removed, which is the
entire point.

## 5. Pairwise mode — Bradley–Terry (bonus)

An alternative that never asks for an absolute score, so there is no hot/cold
judge to correct. A judge is shown two of *their assigned* projects and picks the
better one (`/api/judge/pairwise`). From all comparisons we recover a global
strength per project with the **Bradley–Terry** model,
`P(i beats j) = s_i / (s_i + s_j)`, fitted by the MM (minorization–maximization)
iteration of Hunter (2004) — dependency-free and provably convergent
(`lib/bradley-terry.ts`):

```
s_i ← W_i / Σ_j ( n_ij / (s_i + s_j) )
```

A small virtual win/loss against a strength-1 anchor regularizes projects that
only ever won or only ever lost, so strengths stay finite. Strengths are
geometric-mean-normalized each iteration for numerical stability and mapped to a
1–5 display scale.

On the fixture data (67 seeded comparisons) the pairwise ranking puts **Iron
Switch #1 — the same project the z-score method ranks #1.** Two independent
methods agreeing is the strongest sanity check we have that neither is an
artefact of its own assumptions.

## 6. Vote abuse (community voting, T3)

Community voting is quadratic: casting `credits` on a project converts to
`sqrt(credits)` influence, so concentrating force is expensive (9 credits → 3
influence). Anti-abuse, all in the backend:

- **Rate limits** per IP/user (`lib/rate-limit.ts`).
- **Duplicate detection** via a unique `(project, voter)` key — a second vote
  updates, never stacks.
- **Randomized ballot order**, seeded per voter, to kill position bias.
- **Results hidden** until an organizer publishes, so the outcome can't be
  watched mid-window.
- **Audit trail** (`/api/organizer/audit`) recording every cast, publish, score
  and assignment in human-readable rows.

See `THREAT-MODEL.md` for the attacks we stopped and the ones we did not.

## 7. What we would do next

- Weight normalization by how many projects a judge reviewed (shrinkage toward
  the global mean for judges with only 1–2 reviews, whose `σ_j` is noisy).
- Crowd-BT (active pair selection) so pairwise mode asks the *most informative*
  comparison next, not a random one.
