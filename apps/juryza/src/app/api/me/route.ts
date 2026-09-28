import type { NextRequest } from "next/server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db, user as userTable } from "@/lib/db";
import { audit } from "@/lib/server/audit";
import { conflict, handle, readBody } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { optionalUrl } from "@/lib/server/validation";

/**
 * GET   /api/me — the caller's account and profile.
 * PATCH /api/me — edit the profile (name, username, headline, bio, links,
 *       skills, avatar URL, "looking for a team").
 */

const columns = {
  id: userTable.id,
  name: userTable.name,
  email: userTable.email,
  role: userTable.role,
  username: userTable.username,
  image: userTable.image,
  headline: userTable.headline,
  bio: userTable.bio,
  location: userTable.location,
  websiteUrl: userTable.websiteUrl,
  githubUrl: userTable.githubUrl,
  skills: userTable.skills,
  lookingForTeam: userTable.lookingForTeam,
  createdAt: userTable.createdAt,
};

export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  const [row] = await db.select(columns).from(userTable).where(eq(userTable.id, me.userId));
  return { user: row };
});

const body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:[a-z0-9-_]{1,30}[a-z0-9])$/,
      "3–32 characters: letters, numbers, dashes, underscores"
    )
    .optional(),
  headline: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(80).nullish(),
  websiteUrl: optionalUrl,
  githubUrl: optionalUrl,
  image: optionalUrl,
  skills: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  lookingForTeam: z.boolean().optional(),
});

export const PATCH = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  const raw = (await req
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  const b = await readBody(req, body);
  const sent = (k: string) => Object.hasOwn(raw, k);

  if (b.username) {
    const [taken] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.username, b.username), ne(userTable.id, me.userId)))
      .limit(1);
    if (taken) throw conflict("That username is taken");
  }

  const update: Partial<typeof userTable.$inferInsert> = { updatedAt: new Date() };
  for (const k of [
    "name",
    "username",
    "headline",
    "bio",
    "location",
    "websiteUrl",
    "githubUrl",
    "image",
    "skills",
    "lookingForTeam",
  ] as const) {
    if (sent(k) && b[k] !== undefined) (update as Record<string, unknown>)[k] = b[k];
  }
  await db.update(userTable).set(update).where(eq(userTable.id, me.userId));
  await audit({ actor: me, action: "profile.updated", detail: { fields: Object.keys(raw) }, req });
  const [row] = await db.select(columns).from(userTable).where(eq(userTable.id, me.userId));
  return { user: row };
});
