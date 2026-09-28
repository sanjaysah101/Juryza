import { NextResponse } from "next/server";

import { openApiDocument } from "@/lib/server/openapi";

/**
 * GET /api/openapi.json — the OpenAPI 3.1 document for the whole REST API
 * (built in lib/server/openapi.ts). Public and CORS-open so Swagger UI,
 * Postman or a client generator can load it from anywhere.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function GET() {
  return NextResponse.json(openApiDocument(), {
    headers: { ...CORS, "Cache-Control": "public, max-age=300" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
