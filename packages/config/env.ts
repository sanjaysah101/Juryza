// Import as: import { environment, isProduction } from "@juryza/config/env";

/**
 * The active environment.
 *
 * This project was scaffolded with a SINGLE environment, so there is one value.
 * The indirection is deliberate: code reads `environment` rather than
 * `process.env` directly, so adding development/staging/production later is a
 * change to this file alone.
 */
export type Environment = "development" | "production";

export const environment: Environment =
  process.env.NODE_ENV === "production" ? "production" : "development";

export const isProduction = environment === "production";
export const isDevelopment = environment === "development";
