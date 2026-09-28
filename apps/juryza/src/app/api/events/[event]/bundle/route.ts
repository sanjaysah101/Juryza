import { NextResponse } from "next/server";

import { audit } from "@/lib/server/audit";
import { exportBundle } from "@/lib/server/bundle";
import { loadManagedEvent } from "@/lib/server/events";
import { handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";

/**
 * GET /api/events/:event/bundle — the whole event as one portable JSON file
 * (fixtures-compatible), for backup or moving to another Juryza instance.
 * Re-import with POST /api/events/import.
 */
export const GET = handle<{ event: string }>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const bundle = await exportBundle(e);
  await audit({ eventId: e.id, actor: me, action: "export.bundle", req });
  return NextResponse.json(bundle, {
    headers: { "Content-Disposition": `attachment; filename="${e.slug}.juryza.json"` },
  });
});
