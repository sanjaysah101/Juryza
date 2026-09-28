import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/server/audit";
import { loadManagedEvent } from "@/lib/server/events";
import { buildDataset, DATASETS, type Dataset } from "@/lib/server/exports";
import { badRequest, handle } from "@/lib/server/http";
import { requireUser } from "@/lib/server/identity";

/**
 * GET /api/events/:event/export?dataset=<name>&format=csv|json
 *
 * Organizer exports at every stage: participants, teams, projects,
 * assignments, scores, results, votes, comments, audit. CSV by default
 * (spreadsheet-safe), JSON on request. Every download is audited.
 */
export const GET = handle<{ event: string }>(async (req, { event: ref }) => {
  const me = await requireUser(req);
  const e = await loadManagedEvent(ref, me);
  const url = new URL(req.url);
  const dataset = (url.searchParams.get("dataset") ?? "results") as Dataset;
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  if (!DATASETS.includes(dataset))
    throw badRequest(`dataset must be one of: ${DATASETS.join(", ")}`);

  const { headers, rows } = await buildDataset(e, dataset);
  await audit({
    eventId: e.id,
    actor: me,
    action: "export.downloaded",
    target: dataset,
    detail: { format, rows: rows.length },
    req,
  });

  const filename = `${e.slug}-${dataset}.${format}`;
  const disposition = `attachment; filename="${filename}"`;
  if (format === "json") {
    const records = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
    return NextResponse.json(records, { headers: { "Content-Disposition": disposition } });
  }
  return new NextResponse(toCsv(headers, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": disposition },
  });
});
