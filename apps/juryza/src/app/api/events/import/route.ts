import type { NextRequest } from "next/server";

import { audit } from "@/lib/server/audit";
import { bundleSchema, importBundle } from "@/lib/server/bundle";
import { created, handle, readBody } from "@/lib/server/http";
import { requireRole } from "@/lib/server/identity";

/**
 * POST /api/events/import — create a new event from a bundle: a Juryza export
 * or any file in the DOGFOOD fixtures shape. The event is created as a draft
 * owned by the caller; ids collide-safely, people are matched by email. The
 * response reports what was created and anything skipped.
 */
export const POST = handle(async (req: NextRequest) => {
  const me = await requireRole(req, "organizer");
  const bundle = await readBody(req, bundleSchema);
  const report = await importBundle(bundle, { createdBy: me.userId, visibility: "draft" });
  await audit({
    eventId: report.eventId,
    actor: me,
    action: "event.imported",
    detail: report.created,
    req,
  });
  return created(report);
});
