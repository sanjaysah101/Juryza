import type { NextRequest } from "next/server";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db, user as userTable } from "@/lib/db";
import { handle } from "@/lib/server/http";
import { requireRole } from "@/lib/server/identity";

/**
 * GET /api/admin/users?q=&role=&page= — all accounts (admins). 50 per page.
 */
export const GET = handle(async (req: NextRequest) => {
  await requireRole(req, "admin");
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const role = url.searchParams.get("role")?.trim();
  const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
  const filter = and(
    q
      ? or(
          ilike(userTable.name, `%${q}%`),
          ilike(userTable.email, `%${q}%`),
          ilike(userTable.username, `%${q}%`)
        )
      : undefined,
    role ? eq(userTable.role, role) : undefined
  );

  const [users, [total]] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        username: userTable.username,
        image: userTable.image,
        role: userTable.role,
        banned: userTable.banned,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(filter)
      .orderBy(desc(userTable.createdAt), asc(userTable.name))
      .limit(50)
      .offset(page * 50),
    db.select({ n: sql<number>`count(*)::int` }).from(userTable).where(filter),
  ]);
  return { users, total: total?.n ?? 0, page, pageSize: 50 };
});
