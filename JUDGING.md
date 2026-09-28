# JUDGING.md — assignment, scoring, normalization, pairwise, voting

This document explains — and defends — every number Juryza produces. The code
it describes is small and pure:

| Concern | Code |
| --- | --- |
| Assignment | `apps/juryza/src/lib/assignment.ts` |
| Scoring & normalization | `apps/juryza/src/lib/scoring.ts` |
| Pairwise (Bradley–Terry) | `apps/juryza/src/lib/bradley-terry.ts`, `lib/pairing.ts` |
| Community voting | `apps/juryza/src/lib/voting.ts` |
| Project similarity | `apps/juryza/src/lib/similarity.ts` |
| The one results engine | `apps/juryza/src/lib/server/results.ts` |

**One engine, every surface.** The leaderboard, the organizer's results page,
the compare view, the CSV export and the proof below all call
`computeResults(event)`. They cannot disagree, and nothing is stored
pre-aggregated: re-weighting the rubric or editing a score is reflected
everywhere on the next read. Every function above is covered by unit tests in
`apps/juryza/src/lib/__tests__/`.

---

## 1. Assigning judges

Organizers build a **judging panel** per event (invite by email; an existing
account joins at once, otherwise a single-use link bound to that email address
is created). Each panel member may be limited to some tracks.

Two strategies (`POST /api/events/:event/assignments`, with a `dryRun` preview):

- **Balanced (default).** Every project gets `reviewsPerProject` reviews, each
  from the eligible judge currently carrying the least work (ties broken by id,
  so plans are deterministic). Projects with the fewest eligible judges are
  placed first so they are not starved by projects anyone can review.
- **Batch.** Contiguous chunks, one per judge ("A takes 1–10"): legible when an
  organizer wants to hand out work by hand.

Rules both strategies honour, all enforced in the backend:

- **Track eligibility** — a judge limited to tracks never receives a project
  from another track.
- **Conflicts of interest** — a judge is never assigned a project made by a team
  they belong to (derived from team membership at planning time).
- **Idempotence** — existing assignments count toward coverage and load, so
  re-running tops up rather than piling on; the unique `(judge, project)` key
  makes duplicates impossible.
- **Scoring is scoped to assignments** — `POST /api/judge/scores` refuses any
  project not assigned to the caller, and a judge's reads are scoped to
  `judge_id = caller`. `GET /api/judge/scores?judge=<someone else>` is a 403
  decided before any row is read (and is written to the audit log).

## 2. Scoring

A score is a set of per-criterion marks (integers 1–5) keyed by the event's
rubric. The rubric is **organizer-configurable and weighted**; weights are
relative and normalized at compute time:

```
raw = Σ_c mark_c · w_c  /  Σ_c w_c
```

The API requires a mark for every criterion (no silently partial scores), and
refuses unknown criteria. Scoring closes at `judgingClose` or when results are
published.

## 3. Cross-judge normalization (per-judge z-score)

Judges differ in two systematic ways: **level** (one is generous, one is harsh)
and **spread** (one uses 1–5, one uses 3–4). Averaging raw scores lets a
project's rank depend on which judges happened to draw it. Juryza removes both
effects per judge, then maps back to the familiar 1–5 scale:

```
μ_j, σ_j   = mean and standard deviation of judge j's raw scores
z          = (raw − μ_j) / σ_j
normalized = clamp(globalMean + z · 0.9, 1, 5)
project    = mean of its normalized scores
```

- `globalMean` is the mean of all raw scores — the shared centre.
- `0.9` is roughly the raw spread in the fixture data, so normalized scores
  keep a natural range and remain comparable to raw ones.
- **Flat judges.** A judge whose marks are all identical (the fixture contains
  one on purpose) gives no *ranking* information. Their `z` is 0, so each of
  their scores becomes the global mean: they neither lift nor sink the projects
  they saw. "Identical" is `σ_j ≤ 1e-9`, not `σ_j = 0` — see the bug note below.
- **One-review judges** also get `σ_j = 0` and are treated the same way; their
  single mark cannot be calibrated.

Organizers see each judge's calibration on the Results page — count, mean,
spread, offset from the global mean and a flag (`flat`, `harsh`, `generous`;
flags need at least two reviews).

### Why z-score, and its limits

Z-scoring is the simplest transform that removes both additive bias (μ) and
scale bias (σ) — the two ways judges demonstrably differ in the fixtures. It
assumes each judge saw a roughly representative slice of projects, which the
balanced planner approximates. It does not model project difficulty or
judge-project interaction, and σ is noisy for judges with two or three reviews.
Where that matters, organizers can use pairwise judging (§5), which needs no
calibration at all, and compare the two rankings side by side.

### A bug the proof caught

Identical marks produce a floating-point standard deviation around `1e-16`, not
exactly `0`. The original guard (`σ > 0`) therefore divided noise by noise and
gave a flat judge arbitrary z-scores. On the fixtures this pushed **Green
Switch** from 13th to 24th. The guard is now an epsilon, with a unit test for
the case.

## 4. Normalization proof (fixture data)

Regenerate against a seeded database:

```sh
bun run --cwd apps/juryza src/lib/normalization-proof.ts sample-hack-2026
```

It calls the production `computeResults`, so this is the live maths showing its
work. Data: the 126 fixture scores plus six seeded reviews by the two demo
judges (132 scores, 32 judges, 41 projects). Rubric: Functionality ×0.4, Code
quality ×0.35, Innovation ×0.25.

**Judges genuinely differ** (excerpt, sorted by mean):

| judge | n | mean | sd | offset | flag |
|---|---:|---:|---:|---:|---|
| Tomas Varga | 1 | 2.00 | 0.00 | −1.58 | (one review) |
| Leila Nasser | 2 | 2.98 | 0.48 | −0.61 | harsh |
| Emeka Adeyemi | 3 | 3.05 | 0.65 | −0.53 | harsh |
| … | | | | | |
| Iva Petrova | 3 | 4.00 | 0.00 | +0.42 | **flat** (fixture case) |
| Rafa Okonkwo | 4 | 4.11 | 0.50 | +0.53 | generous |
| Wei Lindqvist | 6 | 4.25 | 0.71 | +0.67 | generous |

**Ranking change, raw → normalized** (top 15 of 41):

| rank | project | reviews | raw | normalized | raw rank | change |
|---:|---|---:|---:|---:|---:|---|
| 1 | Iron Switch | 3 | 4.350 | 4.672 | 1 | — |
| 2 | Slow Trail | 3 | 4.083 | 4.487 | 6 | ▲ 4 |
| 3 | Still Beacon | 2 | 4.250 | 4.362 | 3 | — |
| 4 | Salt Kiln | 3 | 4.067 | 4.356 | 7 | ▲ 3 |
| 5 | Salt Ledger | 4 | 4.338 | 4.318 | 2 | ▼ 3 |
| 6 | Salt Loom | 4 | 4.088 | 4.238 | 5 | ▼ 1 |
| 7 | Dry Relay | 3 | 4.117 | 4.131 | 4 | ▼ 3 |
| 8 | Dry Harbour | 4 | 3.862 | 4.011 | 10 | ▲ 2 |
| 9 | Glass Signal | 4 | 3.525 | 3.791 | 19 | ▲ 10 |
| 10 | Copper Kiln | 3 | 3.933 | 3.788 | 8 | ▼ 2 |
| 11 | Small Loom | 3 | 3.600 | 3.780 | 16 | ▲ 5 |
| 12 | Salt Ferry | 3 | 3.617 | 3.750 | 15 | ▲ 3 |
| 13 | Green Switch | 4 | 3.862 | 3.738 | 9 | ▼ 4 |
| 14 | Dry Harbour (duplicate) | 5 | 3.340 | 3.717 | 31 | ▲ 17 |
| 15 | North Drift | 5 | 3.740 | 3.706 | 12 | ▼ 3 |

37 of 41 projects change rank. **Reading it:** projects that mostly drew harsh
judges climb (Glass Signal ▲10, the second Dry Harbour ▲17); projects that rode
generous judges fall (Salt Ledger ▼3). The top of the table is stable — the
strongest project is strongest under both methods, which is what a correction
should do: fix the unfairness at the margins, not reshuffle everything.

## 5. Pairwise judging — Bradley–Terry

Pairwise mode never asks for an absolute score, so there is no harsh or
generous judge to correct. A judge sees two of *their assigned* projects and
picks the stronger (`/judging/<event>/pairwise`, API
`GET|POST /api/events/:event/pairwise`).

**Model.** Each project has a strength `s`, and `P(i beats j) = s_i/(s_i + s_j)`.
Strengths are fitted by maximum likelihood with Hunter's (2004) MM iteration —
dependency-free and provably convergent:

```
s_i ← W_i / Σ_j n_ij / (s_i + s_j)
```

A small virtual win and loss against a strength-1 anchor keeps undefeated or
winless projects finite; strengths are re-centred (geometric mean 1) each
iteration and mapped to 1–5 for display.

**Active pair selection** (`lib/pairing.ts`). Random pairs waste attention —
the obvious winner versus the obvious loser teaches the model nothing. The next
pair shown is the unseen one that (1) involves the projects this judge has
compared least, then (2) has the closest current strengths, i.e. the least
predictable outcome. Left/right placement is randomized.

The seed derives 67 comparisons from each fixture judge's own ordering
(adjacent projects by that judge's raw score) so the pairwise leaderboard has
signal on first boot. It ranks **Iron Switch first — the same project z-scoring
ranks first.** Two methods with unrelated assumptions agreeing at the top is
the best sanity check available.

## 6. Community voting — quadratic, with a budget

- Every voter gets a **credit budget** per event (default 16). Giving a project
  `v` votes costs `v²` credits. With 16 credits a voter can give one project 4
  votes or sixteen projects 1 vote each — intensity is expressible, piling on is
  expensive. The budget is enforced in the server inside a transaction with a
  per-voter advisory lock, so concurrent requests cannot overspend it.
- **Access modes** (per event): signed-in accounts, email-verified voters
  (6-digit code, optional domain allowlist such as `@university.edu`), or an
  open link (anonymous cookie, capped at 3 voters per network).
- **Randomized ballots**: order is shuffled with a per-voter seed — stable for
  one voter across reloads, different between voters — to remove position bias.
- **No self-votes**: you cannot vote for your own team's project.
- **Hidden results**: tallies are never on the ballot, `GET /results` returns no
  numbers to anyone but the event's organizers until publication, and
  publishing is refused while the voting window is open.

Abuse controls and their limits are in `THREAT-MODEL.md`.

## 7. Automatic project comparison & duplicate detection

`lib/similarity.ts` turns each submission into a TF-IDF weighted bag of words
(title counted twice, tagline, write-up, tech tags counted twice) and compares
projects by cosine similarity; an identical repository URL or title is flagged
outright. It powers three things:

- **Duplicates & look-alikes** for organizers (Submissions page) — on the
  fixtures it immediately surfaces the two "Dry Harbour" submissions that share
  a repository.
- **Similar projects** on every project page.
- **Auto comparison** — open `/e/<event>/compare?ids=<one project>` and the
  server picks the most similar submissions plus (once results are visible) the
  projects ranked directly above and below, then shows per-criterion means,
  normalized score, votes, pairwise head-to-head and content similarity side by
  side.

It is deterministic and runs offline — no model, no external API.

## 8. What we would do next

- Shrink each judge's μ and σ toward the global values in proportion to how few
  projects they reviewed (a two-review judge's σ is mostly noise).
- Report a confidence interval per project (bootstrap over judges) so a close
  finish is shown as a tie rather than a false precision.
- Crowd-BT's full information-gain criterion for pair selection.
