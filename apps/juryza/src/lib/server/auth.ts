import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * The Better Auth server: email + password sessions stored in our own Postgres.
 *
 * The admin plugin supplies the `role`/`banned` columns and user-management
 * endpoints. It only knows `admin` and `user` out of the box, so the platform's
 * role names are declared here. Fine-grained rules (who may score what, who may
 * manage an event) live in the API routes — that is where a curl arrives.
 */

const ac = createAccessControl(defaultStatements);
const roles = {
  participant: ac.newRole({}),
  judge: ac.newRole({}),
  organizer: ac.newRole(adminAc.statements),
  admin: ac.newRole(adminAc.statements),
};

/** A URL-safe handle derived from a name or email, made unique with a suffix. */
async function uniqueUsername(seed: string): Promise<string> {
  const base =
    seed
      .toLowerCase()
      .replace(/@.*/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "user";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const [taken] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

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
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "").split(",").filter(Boolean),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Offline, self-hosted: there is no mail provider, so the link is logged.
      console.info(`[auth] password reset for ${user.email}: ${url}`);
    },
  },

  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (data) => ({
          data: {
            ...data,
            username: await uniqueUsername((data.name as string) || (data.email as string)),
          },
        }),
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },

  plugins: [
    admin({ ac, roles, defaultRole: "participant", adminRoles: ["admin"] }),
    // Must stay last: it flushes cookies other plugins set.
    nextCookies(),
  ],
});
