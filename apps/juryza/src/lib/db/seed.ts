/**
 * Seed the portal from `fixtures.json`.
 *
 * Run at container boot (`bun run boot`) after the schema is pushed. It is
 * idempotent by way of a clean slate: it truncates the domain and auth tables
 * first, so `docker compose up` always produces the same, known state the
 * acceptance checker expects.
 *
 * What it does, in order:
 *  1. Load the shared `fixtures.json` (same file every team seeds).
 *  2. Create the one fixture event with the fixture's *past* close date, so the
 *     "closed event refuses submissions" check passes honestly.
 *  3. Create tracks, prizes and a weighted rubric (the fixture's three criteria).
 *  4. Create every fixture judge as a real `judge` user, every team, every team
 *     member, and every project (all already submitted).
 *  5. Create four well-known test users — organizer / judge_a / judge_b /
 *     participant — mint a bearer token for each, and assign judge_a some
 *     projects with scores so the T2 checks have data.
 *  6. Load the fixture scores.
 *  7. Print the `.dogfood.toml` auth headers and routes so a human can paste
 *     them straight into the config the checker reads.
 *
 * Users are created through Better Auth's own sign-up API so the password hash
 * matches what the login endpoint expects; roles and tokens are then written
 * directly.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";

import { auth } from "@/lib/auth-better-auth-server";
import {
  account,
  apiToken,
  assignment,
  auditLog,
  certificate,
  comment,
  db,
  event,
  judgeTracks,
  pairwiseVote,
  prize,
  project,
  rubricCriterion,
  score,
  session,
  team,
  teamMember,
  track,
  user as userTable,
  verification,
  vote,
  webhook,
  webhookDelivery,
} from "@/lib/db";
import { id, secretToken } from "@/lib/ids";

interface Fixtures {
  event: { id: string; name: string; submissions_close: string };
  tracks: { id: string; name: string }[];
  judges: { id: string; name: string; email: string; tracks: string[] }[];
  teams: { id: string; name: string; members: string[] }[];
  projects: {
    id: string;
    team: string;
    track: string;
    title: string;
    summary: string;
    repo_url: string;
    submitted_at: string;
  }[];
  scores: {
    judge: string;
    project: string;
    criteria: Record<string, number>;
    comment?: string;
  }[];
}

function loadFixtures(): Fixtures {
  // Look next to the repo root (mounted into the container) and a couple of
  // plausible fallbacks so the script works from the app dir or the repo root.
  const candidates = [
    process.env.FIXTURES_PATH,
    join(process.cwd(), "fixtures.json"),
    join(process.cwd(), "..", "..", "fixtures.json"),
    "/app/fixtures.json",
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as Fixtures;
    } catch {}
  }
  throw new Error(`fixtures.json not found. Tried: ${candidates.join(", ")}`);
}

/** Create a user via Better Auth, then force role + return the id. */
async function createUser(opts: {
  email: string;
  name: string;
  password: string;
  role: string;
}): Promise<string> {
  const res = await auth.api.signUpEmail({
    body: { email: opts.email, name: opts.name, password: opts.password },
  });
  const userId = res.user.id;
  await db.update(userTable).set({ role: opts.role }).where(eq(userTable.id, userId));
  return userId;
}

async function mintToken(userId: string, label: string): Promise<string> {
  const token = secretToken();
  await db.insert(apiToken).values({ id: id.apiToken(), token, userId, label });
  return token;
}

async function truncateAll() {
  // Order matters only without CASCADE; TRUNCATE ... CASCADE handles FKs.
  const tables = [
    auditLog,
    certificate,
    webhookDelivery,
    webhook,
    comment,
    vote,
    pairwiseVote,
    score,
    assignment,
    judgeTracks,
    project,
    teamMember,
    team,
    rubricCriterion,
    prize,
    track,
    event,
    apiToken,
    session,
    account,
    verification,
    userTable,
  ];
  for (const t of tables) {
    // biome-ignore lint/suspicious/noExplicitAny: drizzle table meta for name
    const name = (t as any)[Symbol.for("drizzle:Name")] as string;
    await db.execute(sql.raw(`TRUNCATE TABLE "${name}" RESTART IDENTITY CASCADE`));
  }
}

async function main() {
  const fx = loadFixtures();
  console.info("[seed] loaded fixtures:", {
    tracks: fx.tracks.length,
    judges: fx.judges.length,
    teams: fx.teams.length,
    projects: fx.projects.length,
    scores: fx.scores.length,
  });

  await truncateAll();

  // ---- Event ----------------------------------------------------------
  await db.insert(event).values({
    id: fx.event.id,
    name: fx.event.name,
    slug: "sample-hack-2026",
    description: "Seeded from the DOGFOOD 2026 fixture dataset.",
    submissionsOpen: new Date("2026-02-20T00:00:00Z"),
    submissionsClose: new Date(fx.event.submissions_close), // PAST — closes submissions
    // Community voting is OPEN now so the T3 flow is demonstrable end to end in a
    // freshly seeded portal (submissions are closed, voting is live — the natural
    // post-deadline phase). The window is wide around "now".
    votingOpen: new Date(Date.now() - 24 * 60 * 60 * 1000),
    votingClose: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    resultsPublished: false,
  });

  // ---- Tracks ---------------------------------------------------------
  for (const t of fx.tracks) {
    await db.insert(track).values({ id: t.id, eventId: fx.event.id, name: t.name });
  }

  // ---- Prizes ---------------------------------------------------------
  const prizes = [
    { name: "Grand Prize", amount: "$800", rank: 1 },
    { name: "Runner-Up", amount: "$500", rank: 2 },
    { name: "Third Place", amount: "$350", rank: 3 },
  ];
  for (const p of prizes) {
    await db.insert(prize).values({
      id: id.prize(),
      eventId: fx.event.id,
      name: p.name,
      amount: p.amount,
      rank: p.rank,
    });
  }

  // ---- Rubric (the fixture's three criteria, weighted) ----------------
  const rubric = [
    { key: "functionality", label: "Functionality", weight: 0.4, position: 0 },
    { key: "quality", label: "Code Quality", weight: 0.35, position: 1 },
    { key: "innovation", label: "Innovation", weight: 0.25, position: 2 },
  ];
  for (const c of rubric) {
    await db.insert(rubricCriterion).values({
      id: id.criterion(),
      eventId: fx.event.id,
      key: c.key,
      label: c.label,
      weight: c.weight,
      position: c.position,
    });
  }

  // ---- Fixture judges as real users -----------------------------------
  const judgeUserId = new Map<string, string>();
  for (const j of fx.judges) {
    const uid = await createUser({
      email: j.email,
      name: j.name,
      password: "judge-password-123",
      role: "judge",
    });
    judgeUserId.set(j.id, uid);
    // Track eligibility: a track judge only reviews their tracks.
    for (const trackId of j.tracks) {
      await db
        .insert(judgeTracks)
        .values({ eventId: fx.event.id, judgeId: uid, trackId })
        .onConflictDoNothing();
    }
  }

  // ---- Teams + members ------------------------------------------------
  // Fixture team members are emails; create a participant user per unique email.
  const memberUserId = new Map<string, string>();
  async function ensureMember(email: string): Promise<string> {
    const existing = memberUserId.get(email);
    if (existing) return existing;
    const name = email.split("@")[0] ?? email;
    const uid = await createUser({
      email,
      name,
      password: "member-password-123",
      role: "participant",
    });
    memberUserId.set(email, uid);
    return uid;
  }

  for (const t of fx.teams) {
    await db.insert(team).values({
      id: t.id,
      eventId: fx.event.id,
      name: t.name,
      inviteToken: secretToken(),
    });
    for (const [i, email] of t.members.entries()) {
      const uid = await ensureMember(email);
      await db
        .insert(teamMember)
        .values({ teamId: t.id, userId: uid, role: i === 0 ? "owner" : "member" })
        .onConflictDoNothing();
    }
  }

  // ---- Projects (all submitted) ---------------------------------------
  for (const p of fx.projects) {
    await db.insert(project).values({
      id: p.id,
      eventId: fx.event.id,
      teamId: p.team,
      trackId: p.track,
      title: p.title,
      tagline: p.summary,
      summary: p.summary,
      description: p.summary,
      repoUrl: p.repo_url,
      status: "submitted",
      submittedAt: new Date(p.submitted_at),
    });
  }

  // ---- Fixture scores -------------------------------------------------
  // Map fixture judge ids to user ids; skip a score if its judge is unknown.
  for (const s of fx.scores) {
    const judgeUid = judgeUserId.get(s.judge);
    if (!judgeUid) continue;
    await db
      .insert(score)
      .values({
        id: id.score(),
        eventId: fx.event.id,
        judgeId: judgeUid,
        projectId: s.project,
        criteria: s.criteria,
        comment: s.comment ?? null,
      })
      .onConflictDoNothing();
    // Every fixture score implies the judge was assigned that project.
    await db
      .insert(assignment)
      .values({
        id: id.assignment(),
        eventId: fx.event.id,
        judgeId: judgeUid,
        projectId: s.project,
        batch: 1,
      })
      .onConflictDoNothing();
  }

  // ---- Four well-known acceptance-checker users -----------------------
  const organizerId = await createUser({
    email: "organizer@juryza.test",
    name: "Olivia Organizer",
    password: "organizer-password-123",
    role: "organizer",
  });
  const judgeAId = await createUser({
    email: "judge.a@juryza.test",
    name: "Judge A",
    password: "judge-a-password-123",
    role: "judge",
  });
  const judgeBId = await createUser({
    email: "judge.b@juryza.test",
    name: "Judge B",
    password: "judge-b-password-123",
    role: "judge",
  });
  const participantId = await createUser({
    email: "participant@juryza.test",
    name: "Pat Participant",
    password: "participant-password-123",
    role: "participant",
  });

  // Give judge_a and judge_b real assignments + scores so the peer-scores
  // isolation check has something to protect.
  const sampleProjects = fx.projects.slice(0, 3).map((p) => p.id);
  const peerProjects = fx.projects.slice(3, 6).map((p) => p.id);

  for (const pid of sampleProjects) {
    await db
      .insert(assignment)
      .values({
        id: id.assignment(),
        eventId: fx.event.id,
        judgeId: judgeAId,
        projectId: pid,
        batch: 1,
      })
      .onConflictDoNothing();
    await db
      .insert(score)
      .values({
        id: id.score(),
        eventId: fx.event.id,
        judgeId: judgeAId,
        projectId: pid,
        criteria: { functionality: 4, quality: 4, innovation: 3 },
        comment: "Seeded score for judge A.",
      })
      .onConflictDoNothing();
  }
  for (const pid of peerProjects) {
    await db
      .insert(assignment)
      .values({
        id: id.assignment(),
        eventId: fx.event.id,
        judgeId: judgeBId,
        projectId: pid,
        batch: 1,
      })
      .onConflictDoNothing();
    await db
      .insert(score)
      .values({
        id: id.score(),
        eventId: fx.event.id,
        judgeId: judgeBId,
        projectId: pid,
        criteria: { functionality: 3, quality: 5, innovation: 4 },
        comment: "Seeded score for judge B.",
      })
      .onConflictDoNothing();
  }

  // ---- Seed pairwise comparisons (T2 bonus demo) ----------------------
  // Derive comparisons from the fixture scores so the Bradley–Terry ranking has
  // signal on first boot: for each fixture judge, order the projects they scored
  // by weighted raw score and record "higher beats lower" for adjacent pairs.
  const scoresByJudge = new Map<string, { project: string; raw: number }[]>();
  for (const s of fx.scores) {
    const judgeUid = judgeUserId.get(s.judge);
    if (!judgeUid) continue;
    const vals = Object.values(s.criteria);
    const raw = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const list = scoresByJudge.get(judgeUid) ?? [];
    list.push({ project: s.project, raw });
    scoresByJudge.set(judgeUid, list);
  }
  for (const [judgeUid, list] of scoresByJudge) {
    const ordered = [...list].sort((a, b) => b.raw - a.raw);
    for (let i = 0; i + 1 < ordered.length; i++) {
      const winner = ordered[i];
      const loser = ordered[i + 1];
      if (!winner || !loser || winner.raw === loser.raw) continue;
      await db
        .insert(pairwiseVote)
        .values({
          id: id.pairwise(),
          eventId: fx.event.id,
          judgeId: judgeUid,
          winnerId: winner.project,
          loserId: loser.project,
        })
        .onConflictDoNothing();
    }
  }

  // ---- Bearer tokens --------------------------------------------------
  const orgToken = await mintToken(organizerId, "acceptance: organizer");
  const judgeAToken = await mintToken(judgeAId, "acceptance: judge_a");
  const judgeBToken = await mintToken(judgeBId, "acceptance: judge_b");
  const participantToken = await mintToken(participantId, "acceptance: participant");

  // ---- Write .dogfood.toml so the checker runs with zero manual steps -
  const baseUrl = process.env.PORTAL_BASE_URL ?? "http://localhost:8080";
  const dogfoodToml = `# Generated by the Juryza seed script on boot.
# The acceptance checker (run.py) reads this to know where things are and which
# header proves each role. Regenerated on every \`docker compose up\`.

[portal]
base_url = "${baseUrl}"

[tiers]
claimed = ["T1", "T2", "T3", "T4"]
pitch = "Self-hostable, API-first hackathon submission & judging portal: backend-enforced role isolation, documented z-score + Bradley-Terry judging, quadratic voting, OpenAPI, webhooks, verifiable certificates."

[auth]
organizer   = "Authorization: Bearer ${orgToken}"
judge_a     = "Authorization: Bearer ${judgeAToken}"
judge_b     = "Authorization: Bearer ${judgeBToken}"
participant = "Authorization: Bearer ${participantToken}"

[routes]
gallery      = "/api/gallery"
submit       = "/api/projects"
judge_scores = "/api/judge/scores"
peer_scores  = "/api/judge/scores?judge=judge_a"
csv_export   = "/api/organizer/export.csv"
`;
  const tomlCandidates = [
    process.env.DOGFOOD_TOML_PATH,
    join(process.cwd(), "..", "..", ".dogfood.toml"),
    join(process.cwd(), ".dogfood.toml"),
    "/app/.dogfood.toml",
  ].filter(Boolean) as string[];
  for (const path of tomlCandidates) {
    try {
      writeFileSync(path, dogfoodToml, "utf-8");
      console.info(`[seed] wrote ${path}`);
      break;
    } catch {}
  }

  // ---- Print the headers for .dogfood.toml ----------------------------
  const banner = "=".repeat(64);
  console.info(`\n${banner}`);
  console.info("Juryza seeded. .dogfood.toml [auth] headers:");
  console.info(banner);
  console.info(`organizer   = "Authorization: Bearer ${orgToken}"`);
  console.info(`judge_a     = "Authorization: Bearer ${judgeAToken}"`);
  console.info(`judge_b     = "Authorization: Bearer ${judgeBToken}"`);
  console.info(`participant = "Authorization: Bearer ${participantToken}"`);
  console.info(banner);
  console.info("Test logins (email / password) for the UI:");
  console.info("  organizer    organizer@juryza.test / organizer-password-123");
  console.info("  judge A      judge.a@juryza.test   / judge-a-password-123");
  console.info("  judge B      judge.b@juryza.test   / judge-b-password-123");
  console.info("  participant  participant@juryza.test / participant-password-123");
  console.info(`${banner}\n`);
}

main()
  .then(() => {
    console.info("[seed] done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  });
