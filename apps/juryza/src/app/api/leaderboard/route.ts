import type { NextRequest } from "next/server";

import { db, user as userTable } from "@/lib/db";
import { raptorsLeaderboardData } from "@/lib/db/raptors";
import { handle } from "@/lib/server/http";

/**
 * GET /api/leaderboard — Centralized platform leaderboard.
 * Returns global stats and ranked participants based on points, awards,
 * and prize pools from real Hackathon Raptors competitions.
 */
export const GET = handle(async (_req: NextRequest) => {
  const showcaseData = raptorsLeaderboardData();

  // Query all users from the database
  const dbUsers = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      username: userTable.username,
      image: userTable.image,
      githubUrl: userTable.githubUrl,
      headline: userTable.headline,
      bio: userTable.bio,
      skills: userTable.skills,
      points: userTable.points,
      prizeUsd: userTable.prizeUsd,
      awardsCount: userTable.awardsCount,
    })
    .from(userTable);

  const seenUsernames = new Set(
    showcaseData.leaderboard.map((item) => item.username.toLowerCase())
  );
  const seenEmails = new Set(showcaseData.leaderboard.map((item) => item.email.toLowerCase()));

  const dbUserMap = new Map(
    dbUsers.map((u) => [u.username?.toLowerCase() || u.name.toLowerCase(), u])
  );

  const leaderboard = showcaseData.leaderboard.map((item, idx) => {
    const dbMatch =
      (item.username ? dbUserMap.get(item.username.toLowerCase()) : null) ||
      dbUserMap.get(item.personId.toLowerCase()) ||
      dbUserMap.get(item.name.toLowerCase());

    return {
      ...item,
      rank: idx + 1,
      image: dbMatch?.image || item.image,
      points: dbMatch?.points ?? item.points,
      prizeUsd: dbMatch?.prizeUsd ?? item.prizeUsd,
      awardsCount: dbMatch?.awardsCount ?? item.awardsCount,
      headline: dbMatch?.headline || item.headline,
      githubUrl: dbMatch?.githubUrl ?? item.githubUrl,
    };
  });

  // Include any extra registered users who are not part of the showcase data
  const extraUsers = dbUsers.filter(
    (u) =>
      u.username &&
      !seenUsernames.has(u.username.toLowerCase()) &&
      !seenEmails.has(u.email.toLowerCase())
  );

  for (const u of extraUsers) {
    const username = u.username || u.email.split("@")[0] || "builder";
    leaderboard.push({
      personId: u.id,
      name: u.name,
      username,
      email: u.email,
      image: u.image || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`,
      githubUrl: u.githubUrl ?? null,
      points: u.points ?? 0,
      prizeUsd: u.prizeUsd ?? 0,
      awardsCount: u.awardsCount ?? 0,
      eventsCount: 0,
      headline: u.headline || "Juryza Builder",
      bio: u.bio || "",
      skills: u.skills || [],
      rank: leaderboard.length + 1,
    });
  }

  return {
    totals: {
      ...showcaseData.totals,
      people: leaderboard.length,
    },
    events: showcaseData.events,
    leaderboard,
  };
});
