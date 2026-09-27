import { NextResponse } from "next/server";

/**
 * OpenAPI 3.1 description of the public REST surface (T4 + API-First bonus).
 *
 * "Not one of them ships a public API." Juryza does, and describes it here so a
 * client can be generated. Every action the UI takes is an HTTP call documented
 * below; auth is a bearer token minted per user (the same credential the
 * acceptance checker uses). Served as static JSON so it works offline.
 */
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Juryza API",
    version: "1.0.0",
    description:
      "Submission & judging platform REST API. Bearer-token auth; role enforced in the backend.",
    license: { name: "MIT" },
  },
  servers: [{ url: "http://localhost:8080", description: "Local portal" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "API token minted per user." },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/gallery": {
      get: {
        summary: "Public project gallery",
        security: [],
        parameters: [
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search title/tagline/summary",
          },
          {
            name: "track",
            in: "query",
            schema: { type: "string" },
            description: "Filter by track id",
          },
        ],
        responses: { "200": { description: "List of submitted projects" } },
      },
    },
    "/api/projects": {
      get: {
        summary: "List the caller's projects",
        responses: { "200": { description: "OK" }, "401": { description: "Unauthenticated" } },
      },
      post: {
        summary: "Create/submit a project (refused after the deadline)",
        responses: {
          "201": { description: "Created" },
          "403": { description: "Submissions closed" },
        },
      },
    },
    "/api/projects/{id}": {
      get: {
        summary: "Read a project",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      patch: {
        summary: "Edit until the deadline",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "403": { description: "Closed or not yours" } },
      },
    },
    "/api/teams": {
      get: { summary: "List the caller's teams", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Create a team (returns invite link)",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/teams/join": {
      post: {
        summary: "Join a team by invite token",
        responses: { "200": { description: "Joined" } },
      },
    },
    "/api/events": {
      get: { summary: "List events", security: [], responses: { "200": { description: "OK" } } },
      post: {
        summary: "Create an event (organizer)",
        responses: { "201": { description: "Created" }, "403": { description: "Forbidden" } },
      },
    },
    "/api/rubric": {
      get: {
        summary: "Active event weighted rubric",
        security: [],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/tracks": {
      get: {
        summary: "Active event tracks",
        security: [],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/judge/scores": {
      get: {
        summary: "A judge's own scores (role-isolated)",
        parameters: [
          {
            name: "judge",
            in: "query",
            schema: { type: "string" },
            description: "Whose scores; must be the caller",
          },
        ],
        responses: {
          "200": { description: "OK" },
          "403": { description: "Not this judge / not a judge" },
        },
      },
      post: {
        summary: "Save a score for an assigned project",
        responses: { "200": { description: "OK" }, "403": { description: "Not assigned" } },
      },
    },
    "/api/judge/assignments": {
      get: {
        summary: "Projects assigned to the caller",
        responses: { "200": { description: "OK" }, "403": { description: "Not a judge" } },
      },
    },
    "/api/organizer/dashboard": {
      get: {
        summary: "Progress + normalized results (organizer)",
        responses: { "200": { description: "OK" }, "403": { description: "Forbidden" } },
      },
    },
    "/api/organizer/assign": {
      post: {
        summary: "Generate assignments (round-robin/batch)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/organizer/publish": {
      post: { summary: "Publish/unpublish results", responses: { "200": { description: "OK" } } },
    },
    "/api/organizer/audit": {
      get: { summary: "Audit trail (organizer)", responses: { "200": { description: "OK" } } },
    },
    "/api/organizer/export.csv": {
      get: {
        summary: "Results CSV export (organizer)",
        responses: { "200": { description: "text/csv" } },
      },
    },
    "/api/organizer/export.json": {
      get: {
        summary: "Full event JSON export (organizer)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/organizer/import": {
      post: {
        summary: "Import an event bundle (organizer)",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/vote": {
      get: {
        summary: "Voting ballot (randomized, tallies hidden)",
        security: [],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Cast a quadratic vote",
        security: [],
        responses: {
          "200": { description: "OK" },
          "403": { description: "Voting closed" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/results": {
      get: {
        summary: "Results (hidden until published)",
        security: [],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/projects/{id}/comments": {
      get: {
        summary: "List comments",
        security: [],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Post a comment (authenticated, rate-limited)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" }, "429": { description: "Rate limited" } },
      },
    },
    "/api/webhooks": {
      get: { summary: "List webhooks (organizer)", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Register a webhook (organizer)",
        responses: { "201": { description: "Created (secret returned once)" } },
      },
    },
    "/api/certificates": {
      post: {
        summary: "Issue a participation certificate (organizer)",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/certificates/{serial}": {
      get: {
        summary: "Verify a certificate (public)",
        security: [],
        parameters: [{ name: "serial", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Includes valid: boolean" },
          "404": { description: "Not found" },
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(spec);
}
