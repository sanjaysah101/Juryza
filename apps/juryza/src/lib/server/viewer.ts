import { eq, sql } from "drizzle-orm";

import type { Viewer } from "@/components/viewer";
import { db, eventJudge } from "@/lib/db";
import { getViewer } from "@/lib/server/identity";

/** The viewer object layouts pass to client components (or null when signed out). */
export async function loadViewer(): Promise<Viewer | null> {
  const me = await getViewer();
  if (!me) return null;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventJudge)
    .where(eq(eventJudge.userId, me.userId));
  return {
    userId: me.userId,
    name: me.name,
    email: me.email,
    username: me.username,
    image: me.image,
    role: me.role,
    judgeEvents: row?.n ?? 0,
  };
}
