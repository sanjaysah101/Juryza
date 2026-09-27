import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { db, schema } from "@/lib/db";
import { ac, roles } from "@/lib/permissions";

/**
 * The Better Auth server instance.
 *
 * Backed by the project's own Postgres via the Drizzle adapter — the same
 * database the domain tables live in, so a `user` row and its `team_member`
 * rows sit side by side. State survives restarts (unlike the scaffold's memory
 * adapter), which is what `docker compose up` seeding depends on.
 *
 * The **admin plugin** provides the five-role model the spec demands
 * (visitor | participant | judge | organizer | admin). It adds the `role`,
 * `banned`, `banReason`, `banExpires` columns (declared in `schema.ts`) and the
 * server-side helpers used to gate organizer/admin actions. Role checks live in
 * the backend, never the UI — that is the isolation the acceptance suite curls.
 */

export const ROLES = ["visitor", "participant", "judge", "organizer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const auth = betterAuth({
  appName: "Juryza",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  basePath: "/api/auth",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // No email provider in a self-hosted, offline portal — log the link so the
      // flow is demonstrable end to end without an outbound dependency.
      console.info(`[auth] password reset for ${user.email}: ${url}`);
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  plugins: [
    admin({
      // The five-role model lives in `permissions.ts`; the plugin needs the
      // access controller and role objects so custom names (organizer, judge,
      // participant) are valid. Default role for a fresh sign-up is
      // "participant"; a visitor is simply an unauthenticated request.
      ac,
      roles,
      defaultRole: "participant",
      adminRoles: ["admin", "organizer"],
    }),
    // Must stay LAST: it flushes cookies other plugins set.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
