import { z } from "zod";

/** Shared request-body building blocks. */

export const optionalUrl = z
  .union([z.url({ protocol: /^https?$/, message: "Must be an http(s) URL" }), z.literal("")])
  .nullish()
  .transform((v) => v || null);

export const isoDate = z.iso.datetime({ offset: true, message: "Must be an ISO 8601 date" });
export const optionalDate = isoDate.nullish();

/** A ProseMirror document from the editor. Structure is enforced at render time. */
export const richDoc = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .nullish();

const RESERVED_SLUGS = new Set(["import", "new", "api", "admin", "settings"]);

export const slug = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only")
  .refine((s) => !RESERVED_SLUGS.has(s), "That URL is reserved");

export const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);
