import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Forwards the requested path to server components as `x-pathname`, so the
 * signed-in layout can send an anonymous visitor to /login and bring them back
 * to where they were going. No auth decisions happen here — those live in the
 * layouts and, authoritatively, in every API route.
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|js)$).*)"],
};
