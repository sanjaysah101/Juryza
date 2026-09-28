import type { NextRequest } from "next/server";

import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";
import { overviewFor } from "@/lib/server/people";

/**
 * GET /api/me/overview — everything on the caller's dashboard: events they
 * joined (with their team), their projects, judging queues with progress,
 * events they organize, and certificates they hold.
 */
export const GET = handle(async (req: NextRequest) => {
  const me = await requireUser(req);
  return overviewFor(me.userId);
});
