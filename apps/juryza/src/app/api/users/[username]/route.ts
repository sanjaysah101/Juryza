import { handle, notFound } from "@/lib/server/http";
import { publicProfile } from "@/lib/server/people";

/**
 * GET /api/users/:username — a public profile: bio, skills, links, submitted
 * projects, judging panels and certificates. No email address is exposed.
 */
export const GET = handle<{ username: string }>(async (_req, { username }) => {
  const profile = await publicProfile(username);
  if (!profile) throw notFound("No such user");
  return profile;
});
