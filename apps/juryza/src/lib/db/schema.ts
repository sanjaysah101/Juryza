/**
 * Drizzle schema for Juryza — the whole persistence model in one file.
 *
 * Two families of tables live here:
 *
 * 1. **Better Auth tables** (`user`, `session`, `account`, `verification`) —
 *    owned by Better Auth's Drizzle adapter. Their columns match what the admin
 *    plugin expects. We add a `role` column to `user` for the five-role model.
 * 2. **Domain tables** (events, tracks, prizes, teams, projects, judge
 *    assignments, scores, votes, comments) — the hackathon platform itself.
 *
 * Every id is a text ULID/nanoid string, matching the fixture shape (`"evt_01"`,
 * `"prj_01"`, …) so seeded rows can keep their original identifiers and foreign
 * keys line up with the acceptance checker's expectations.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Better Auth core tables                                            */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  // Five-role model from the spec: visitor | participant | judge | organizer | admin.
  // Managed by the Better Auth admin plugin; enforced in the backend.
  role: text("role").default("participant").notNull(),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

/**
 * API tokens — the bearer credentials the acceptance checker uses.
 *
 * The checker never logs in; it attaches a static `Authorization: Bearer <token>`
 * header we hand it in `.dogfood.toml`. Each row maps a long-lived opaque token
 * to a user, so a request carrying it resolves to that user's role in the
 * backend. Seeded for the four fixture roles; also mintable by any signed-in user
 * for programmatic access (T4 API-first).
 */
export const apiToken = pgTable("api_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  label: text("label"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

/* ------------------------------------------------------------------ */
/* Domain tables                                                      */
/* ------------------------------------------------------------------ */

export const event = pgTable("event", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  submissionsOpen: timestamp("submissions_open"),
  submissionsClose: timestamp("submissions_close").notNull(),
  // Voting window (T3). Results are hidden until it closes.
  votingOpen: timestamp("voting_open"),
  votingClose: timestamp("voting_close"),
  // Whether results are published to the public (organizer toggle, T3).
  resultsPublished: boolean("results_published").default(false).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const track = pgTable("track", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const prize = pgTable("prize", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  amount: text("amount"),
  rank: integer("rank"),
});

/**
 * Organizer-configurable, weighted scoring criteria (T2).
 *
 * The market leader cannot weight criteria at all — this is the differentiator.
 * `weight` is a positive number; JUDGING.md documents that final scores are the
 * weighted mean normalized so weights sum to 1 at compute time.
 */
export const rubricCriterion = pgTable("rubric_criterion", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  weight: real("weight").default(1).notNull(),
  position: integer("position").default(0).notNull(),
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Invite-link token: whoever holds the link can join the team. Simple by
  // design (per project decision: no heavyweight invitation/acceptance flow).
  inviteToken: text("invite_token").notNull().unique(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const teamMember = pgTable(
  "team_member",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(), // owner | member
    joinedAt: timestamp("joined_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })]
);

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => team.id, { onDelete: "set null" }),
  trackId: text("track_id").references(() => track.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  tagline: text("tagline"),
  summary: text("summary"),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  galleryUrls: jsonb("gallery_urls").$type<string[]>().default([]),
  videoUrl: text("video_url"),
  repoUrl: text("repo_url"),
  liveUrl: text("live_url"),
  techTags: jsonb("tech_tags").$type<string[]>().default([]),
  // Organizer-defined custom question answers, keyed by question id.
  customAnswers: jsonb("custom_answers").$type<Record<string, string>>().default({}),
  // draft until submitted; editable until the deadline.
  status: text("status").default("draft").notNull(), // draft | submitted
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Which tracks a judge is eligible to review (T2).
 *
 * "A track judge must never see another track." Eligibility is captured here and
 * honored by the assignment algorithm (`lib/assignment.ts`) and again enforced
 * in the backend at read time. A judge with no rows here is a generalist,
 * eligible for every track. Mirrors the fixture judges' `tracks` array.
 */
export const judgeTracks = pgTable(
  "judge_tracks",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    judgeId: text("judge_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.judgeId, t.trackId] })]
);

/**
 * Judge ↔ project assignment (T2).
 *
 * A judge only ever sees the projects assigned to them. Rows are created by the
 * organizer, either by batch or by the round-robin algorithm in
 * `lib/assignment.ts`. Uniqueness stops a judge being assigned the same project
 * twice.
 */
export const assignment = pgTable(
  "assignment",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    judgeId: text("judge_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    batch: integer("batch").default(1).notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique().on(t.judgeId, t.projectId)]
);

/**
 * A judge's score for one project (T2).
 *
 * `criteria` holds the per-criterion 1–5 marks keyed by criterion key, matching
 * the fixture's `scores[].criteria` shape. The weighted aggregate and the
 * normalized value are computed on read (see `lib/scoring.ts`) rather than
 * stored, so re-weighting the rubric never leaves stale numbers behind.
 */
export const score = pgTable(
  "score",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    judgeId: text("judge_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    criteria: jsonb("criteria").$type<Record<string, number>>().notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique().on(t.judgeId, t.projectId)]
);

/**
 * Pairwise comparison (T2 bonus — Gavel-style).
 *
 * A judge is shown two projects and picks the winner; a Bradley–Terry estimator
 * recovers a global ranking. Stored append-only so the estimator can be re-run.
 */
export const pairwiseVote = pgTable("pairwise_vote", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  judgeId: text("judge_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  winnerId: text("winner_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  loserId: text("loser_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Community vote (T3).
 *
 * `weight` supports quadratic voting: casting n votes on one project costs the
 * caller influence, so the stored influence is sqrt-scaled at tally time. A
 * voter is identified by `voterKey` (authenticated user id, or a hashed
 * email/ip for gated/open modes) to make duplicate detection possible.
 */
export const vote = pgTable(
  "vote",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    voterKey: text("voter_key").notNull(),
    credits: integer("credits").default(1).notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [unique().on(t.projectId, t.voterKey)]
);

export const comment = pgTable("comment", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  authorName: text("author_name"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Append-only audit trail (T2/T3 — "an audit trail an organizer can read").
 *
 * Every score, assignment, export, vote and role change writes a row here.
 * Human-readable on purpose so an organizer can read it without a DB client.
 */
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  eventId: text("event_id"),
  actorId: text("actor_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  target: text("target"),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Webhook subscriptions (T4).
 *
 * An organizer registers a URL to receive JSON POSTs when events happen
 * (project submitted, score saved, results published, …). Each delivery is
 * signed with the subscription's `secret` via an HMAC header so the receiver can
 * verify authenticity. Delivery attempts are logged in `webhookDelivery`.
 */
export const webhook = pgTable("webhook", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => event.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  // Which event types to deliver; empty = all.
  events: jsonb("events").$type<string[]>().default([]),
  active: boolean("active").default(true).notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const webhookDelivery = pgTable("webhook_delivery", {
  id: text("id").primaryKey(),
  webhookId: text("webhook_id")
    .notNull()
    .references(() => webhook.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: integer("status"),
  ok: boolean("ok").default(false).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Judge participation certificates (T4).
 *
 * A signed, publicly verifiable record that a judge reviewed for an event. The
 * `signature` is an HMAC over the canonical fields; anyone can re-verify it at
 * `/api/certificates/<id>` without an account. `serial` is the human-facing id.
 */
export const certificate = pgTable("certificate", {
  id: text("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  subjectId: text("subject_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  subjectName: text("subject_name").notNull(),
  kind: text("kind").notNull(), // judge-participation | winner | …
  statement: text("statement").notNull(),
  reviewsCompleted: integer("reviews_completed").default(0).notNull(),
  signature: text("signature").notNull(),
  issuedAt: timestamp("issued_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

/* ------------------------------------------------------------------ */
/* Relations                                                          */
/* ------------------------------------------------------------------ */

export const eventRelations = relations(event, ({ many }) => ({
  tracks: many(track),
  prizes: many(prize),
  criteria: many(rubricCriterion),
  teams: many(team),
  projects: many(project),
}));

export const trackRelations = relations(track, ({ one, many }) => ({
  event: one(event, { fields: [track.eventId], references: [event.id] }),
  projects: many(project),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  event: one(event, { fields: [team.eventId], references: [event.id] }),
  members: many(teamMember),
  projects: many(project),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, { fields: [teamMember.teamId], references: [team.id] }),
  user: one(user, { fields: [teamMember.userId], references: [user.id] }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  event: one(event, { fields: [project.eventId], references: [event.id] }),
  team: one(team, { fields: [project.teamId], references: [team.id] }),
  track: one(track, { fields: [project.trackId], references: [track.id] }),
  assignments: many(assignment),
  scores: many(score),
  votes: many(vote),
  comments: many(comment),
}));

export const assignmentRelations = relations(assignment, ({ one }) => ({
  event: one(event, { fields: [assignment.eventId], references: [event.id] }),
  judge: one(user, { fields: [assignment.judgeId], references: [user.id] }),
  project: one(project, { fields: [assignment.projectId], references: [project.id] }),
}));

export const scoreRelations = relations(score, ({ one }) => ({
  event: one(event, { fields: [score.eventId], references: [event.id] }),
  judge: one(user, { fields: [score.judgeId], references: [user.id] }),
  project: one(project, { fields: [score.projectId], references: [project.id] }),
}));

export type User = typeof user.$inferSelect;
export type Event = typeof event.$inferSelect;
export type Track = typeof track.$inferSelect;
export type Prize = typeof prize.$inferSelect;
export type RubricCriterion = typeof rubricCriterion.$inferSelect;
export type Team = typeof team.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Assignment = typeof assignment.$inferSelect;
export type Score = typeof score.$inferSelect;
export type Vote = typeof vote.$inferSelect;
export type Comment = typeof comment.$inferSelect;
export type ApiToken = typeof apiToken.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type Webhook = typeof webhook.$inferSelect;
export type WebhookDelivery = typeof webhookDelivery.$inferSelect;
export type Certificate = typeof certificate.$inferSelect;
export type PairwiseVote = typeof pairwiseVote.$inferSelect;
