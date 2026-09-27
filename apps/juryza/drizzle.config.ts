import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. `bun run db:push` reads this to sync `schema.ts` to the
 * Postgres pointed at by `DATABASE_URL`. Used by the container entrypoint before
 * seeding so the portal comes up with its tables already in place.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://juryza:juryza@localhost:5432/juryza",
  },
});
