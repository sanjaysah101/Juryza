import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ZodError, type z } from "zod";

/**
 * Route-handler plumbing.
 *
 * Every API route is written as a plain async function that either returns data
 * or throws an `HttpError`. `handle()` turns that into a response: thrown
 * `HttpError`s become `{ error }` JSON with their status, `ZodError`s become a
 * 400 with the issues, and anything else is logged and returned as a 500 that
 * leaks nothing. This keeps each route to its actual rules — who may call it and
 * what it changes — instead of repeating the same four `if` blocks.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const badRequest = (m = "Invalid request", extra?: Record<string, unknown>) =>
  new HttpError(400, m, extra);
export const unauthorized = (m = "Authentication required") => new HttpError(401, m);
export const forbidden = (m = "You do not have permission to do that") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, params: P) => Promise<Response | unknown>;

export function handle<P = Record<string, never>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "Invalid request", issues: err.issues },
      { status: 400 }
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Parse a JSON body against a schema; a malformed body is a 400, not a 500. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const raw = await req.json().catch(() => {
    throw badRequest("Request body must be JSON");
  });
  return schema.parse(raw);
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
