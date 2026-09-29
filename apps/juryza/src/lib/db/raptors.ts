/**
 * Hackathon Raptors showcase data — built from the community's own published
 * dataset (https://rank.raptors.dev/data/leaderboard.json), vendored alongside
 * this file as `raptors-leaderboard.json`.
 *
 * It lets an evaluator see Juryza driving real-world data: real events, real
 * project and team names, real placements and prize money, with leaderboards
 * and awards that Juryza recomputes from seeded scores.
 *
 * What is real vs. reconstructed:
 *  - Real: event names, slugs, end dates, prize pools; and for every award, the
 *    project title, team name, the person on it, the placement/label, the prize
 *    amount, the code URL, and — where the dataset has it — the published
 *    `final_score` (0–5).
 *  - Reconstructed for the demo: per-judge marks. The dataset publishes a single
 *    final score per project, not the underlying ballots, so three judges' marks
 *    are synthesized to average to that score (or to a placement-derived score
 *    when none was published). This faithfully reproduces the published podium
 *    when Juryza recomputes it; it is not a claim about how any real judge voted.
 *
 * Seeded through the same `importBundle` path as every other event.
 */

import raw from "@/lib/db/raptors-leaderboard.json";
import type { Bundle } from "@/lib/server/bundle";

const DAY = 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------------- */
/* Shapes of the published dataset (only the fields we consume).    */
/* ---------------------------------------------------------------- */

interface AwardEntry {
  event_slug: string;
  event_name: string;
  ended: string;
  kind: "podium" | "category" | "special" | "side_quest" | "honourable_mention";
  placement: number | null;
  label: string | null;
  team: string | null;
  project: string | null;
  prize_usd: number | null;
  final_score: number | null;
  code_url: string | null;
}

interface Person {
  display_name: string | null;
  entries: AwardEntry[];
}

interface EventMeta {
  slug: string;
  name: string;
  ended: string;
  prize_usd: number | null;
  awards: number;
}

interface Leaderboard {
  events: EventMeta[];
  people: Person[];
}

const data = raw as unknown as Leaderboard;

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

const money = (usd: number | null | undefined) =>
  usd && usd > 0 ? `$${usd.toLocaleString("en-US")}` : null;

/** A person's award, with the person attached so we can name the team roster. */
interface OwnedEntry extends AwardEntry {
  person: string | null;
}

/** A reconstructed project: one distinct `project` title within an event. */
interface RaptorsProject {
  title: string;
  team: string;
  members: string[];
  codeUrl: string | null;
  bestScore: number | null;
  bestPlacement: number | null;
  labels: string[];
}

const slugId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";

/**
 * A placement-derived score on the 0–5 scale, used only when the dataset has no
 * published `final_score` for an entry. Keeps the podium order intact.
 */
function placementScore(placement: number | null): number {
  switch (placement) {
    case 1:
      return 4.6;
    case 2:
      return 4.2;
    case 3:
      return 3.8;
    default:
      return 3.3;
  }
}

/* Three named judges per event; enough for cross-judge normalization to bite. */
const JUDGE_NAMES = ["Jamie Rivera", "Priya Nair", "Marcus Bloom"];

const RUBRIC: NonNullable<Bundle["rubric"]> = [
  { key: "impact", label: "Impact", weight: 0.3, description: "Does it matter?" },
  { key: "execution", label: "Execution", weight: 0.4, description: "Is it well built?" },
  { key: "originality", label: "Originality", weight: 0.3, description: "Is it a fresh idea?" },
];

const doc = (text: string): Bundle["projects"][number]["content"] => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Group every published award by the event it belongs to. */
function entriesByEvent(): Map<string, OwnedEntry[]> {
  const byEvent = new Map<string, OwnedEntry[]>();
  for (const person of data.people) {
    for (const e of person.entries) {
      const owned: OwnedEntry = { ...e, person: person.display_name };
      byEvent.set(e.event_slug, [...(byEvent.get(e.event_slug) ?? []), owned]);
    }
  }
  return byEvent;
}

/** Collapse an event's award entries into distinct projects with rosters. */
function projectsOf(entries: OwnedEntry[]): RaptorsProject[] {
  const byProject = new Map<string, RaptorsProject>();
  for (const e of entries) {
    // The dataset occasionally omits a team or project name; fall back so the
    // schema always gets a non-empty string, and skip entries with neither.
    const title = e.project?.trim() || e.team?.trim();
    if (!title) continue;
    const team = e.team?.trim() || title;
    const person = e.person?.trim() || team;
    const key = `${team}::${title}`;
    const existing = byProject.get(key);
    if (existing) {
      if (!existing.members.includes(person)) existing.members.push(person);
      if (e.code_url && !existing.codeUrl) existing.codeUrl = e.code_url;
      if (
        e.final_score !== null &&
        (existing.bestScore === null || e.final_score > existing.bestScore)
      )
        existing.bestScore = e.final_score;
      if (
        e.placement !== null &&
        (existing.bestPlacement === null || e.placement < existing.bestPlacement)
      )
        existing.bestPlacement = e.placement;
      if (e.label && !existing.labels.includes(e.label)) existing.labels.push(e.label);
    } else {
      byProject.set(key, {
        title,
        team,
        members: [person],
        codeUrl: e.code_url,
        bestScore: e.final_score,
        bestPlacement: e.placement,
        labels: e.label ? [e.label] : [],
      });
    }
  }
  return [...byProject.values()];
}

/* ---------------------------------------------------------------- */
/* Bundle builder                                                   */
/* ---------------------------------------------------------------- */

/**
 * Build one import bundle per Hackathon Raptors event, newest first. Only
 * events with at least one distinct project are included (a few published no
 * results). Dates are anchored to the real end date, firmly in the past.
 */
export function raptorsBundles(): Bundle[] {
  const grouped = entriesByEvent();
  const metaBySlug = new Map(data.events.map((e) => [e.slug, e]));
  const bundles: Bundle[] = [];

  const sorted = [...grouped.entries()].sort((a, b) => {
    const da = a[1][0]?.ended ?? "";
    const db = b[1][0]?.ended ?? "";
    return db.localeCompare(da);
  });

  for (const [slug, entries] of sorted) {
    const projects = projectsOf(entries);
    if (projects.length === 0) continue;

    const meta = metaBySlug.get(slug);
    const name = meta?.name ?? entries[0]?.event_name ?? slug;
    const endedStr = meta?.ended ?? entries[0]?.ended ?? "2025-01-01";
    const endedAt = new Date(`${endedStr}T18:00:00Z`).getTime();
    const submissionsClose = new Date(endedAt - 2 * DAY).toISOString();
    const submissionsOpen = new Date(endedAt - 5 * DAY).toISOString();
    const judgingClose = new Date(endedAt).toISOString();
    const eslug = `raptors-${slug}`;

    // Order projects by the podium, then by published score, so the recomputed
    // leaderboard matches the announcement.
    const ordered = [...projects].sort((a, b) => {
      const pa = a.bestPlacement ?? 99;
      const pb = b.bestPlacement ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.bestScore ?? 0) - (a.bestScore ?? 0);
    });

    const bundleProjects: Bundle["projects"] = ordered.map((p, i) => ({
      id: `${eslug}_prj_${i + 1}`,
      team: `${eslug}_tm_${i + 1}`,
      title: p.title,
      tagline: p.labels[0] ? `Award: ${p.labels[0]}` : null,
      summary: `${p.title} by ${p.team} — ${name}.`,
      content: doc(
        `${p.title} by ${p.team} at ${name}.${p.labels.length ? ` Recognised for: ${p.labels.join(", ")}.` : ""}`
      ),
      repo_url: p.codeUrl ?? null,
      tech_tags: [],
      status: "submitted",
      submitted_at: submissionsClose,
    }));

    // The importer treats each team member as an email address, so emit valid
    // addresses derived from the person's name, namespaced per event so the
    // same handle across events doesn't collapse into one account.
    const teams: Bundle["teams"] = ordered.map((p, i) => ({
      id: `${eslug}_tm_${i + 1}`,
      name: p.team,
      members: p.members.map(
        (person, mi) => `${slugId(person) || `member-${mi + 1}`}.${eslug}@raptors.example`
      ),
    }));

    const judges: Bundle["judges"] = JUDGE_NAMES.map((jn, i) => ({
      id: `${eslug}_jd_${i + 1}`,
      name: jn,
      email: `${slugId(jn)}.${eslug}@raptors.example`,
      tracks: [],
    }));

    // Scores: three judges whose marks average to the project's published (or
    // placement-derived) 0–5 score, with a small per-judge offset so the
    // normalization step has spread to correct.
    const scores: Bundle["scores"] = [];
    ordered.forEach((p, pi) => {
      const target = p.bestScore ?? placementScore(p.bestPlacement);
      judges.forEach((j, ji) => {
        const offset = (ji - 1) * 0.2;
        const mark = (d: number) => Math.min(5, Math.max(1, Math.round(target + d + offset)));
        scores.push({
          judge: j.id,
          project: `${eslug}_prj_${pi + 1}`,
          criteria: { impact: mark(0), execution: mark(0.15), originality: mark(-0.15) },
          comment: "Showcase review (reconstructed to match the published result).",
        });
      });
    });

    // Prizes: the real podium as overall ranks, with published amounts.
    const podium = ordered
      .filter((p) => p.bestPlacement !== null && p.bestPlacement <= 3)
      .slice(0, 3);
    const prizeAmount = money(meta?.prize_usd);
    const prizes: Bundle["prizes"] = podium.length
      ? podium.map((p) => ({
          name: `${["", "1st", "2nd", "3rd"][p.bestPlacement ?? 1]} place`,
          kind: "overall" as const,
          amount: p.bestPlacement === 1 ? prizeAmount : null,
          rank: p.bestPlacement ?? 1,
        }))
      : [{ name: "1st place", kind: "overall", amount: prizeAmount, rank: 1 }];

    bundles.push({
      format: "juryza-bundle-raptors-showcase",
      event: {
        slug: eslug,
        name,
        tagline: `A Hackathon Raptors event${prizeAmount ? ` · ${prizeAmount} prize pool` : ""}.`,
        description: `${name} — a Hackathon Raptors event, rebuilt from published results (rank.raptors.dev) for the Juryza showcase. ${projects.length} recognised ${projects.length === 1 ? "project" : "projects"}.`,
        submissions_open: submissionsOpen,
        submissions_close: submissionsClose,
        judging_close: judgingClose,
        hue: Math.abs([...slug].reduce((hh, c) => (hh * 31 + c.charCodeAt(0)) | 0, 7)) % 360,
      },
      tracks: [],
      rubric: RUBRIC,
      prizes,
      judges,
      teams,
      projects: bundleProjects,
      scores,
      pairwise: [],
    });
  }

  return bundles;
}
