"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Code2,
  Crown,
  ExternalLink,
  GitCompareArrows,
  Lock,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@juryza/ui/components/ui/command";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@juryza/ui/components/ui/popover";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { cn } from "@juryza/ui/lib/utils";

import { Section } from "@/components/page";
import { type GalleryResponse, ProjectCover } from "@/components/project-card";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";

/**
 * Side-by-side project comparison. Pass `?ids=a,b[,c,d]`, or a single id and
 * the server picks the rivals (most similar by content, plus the neighbours in
 * the ranking once results are visible). Scores only appear once results are
 * published (or for organizers); the content comparison — similarity and
 * shared tech — is always available.
 */

interface CompareResult {
  rank: number | null;
  trackRank: number | null;
  normalized: number | null;
  raw: number | null;
  reviews: number;
  criteria: Record<string, number | null>;
  votes: number;
  pairwise: { strength: number; scaled: number; wins: number; losses: number } | null;
  awards: { prizeId: string; name: string; amount: string | null }[];
}

interface CompareProject {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  techTags: string[];
  trackName: string | null;
  teamName: string | null;
  result: CompareResult | null;
}

interface CompareResponse {
  auto: boolean;
  showScores: boolean;
  criteria: { key: string; label: string; weight: number }[];
  projects: CompareProject[];
  similarity: number[][];
  headToHead: { winnerId: string; loserId: string }[];
}

const MAX = 4;
const SCALE = 5;

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ids = (search.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);
  const idsKey = ids.join(",");

  const { data, isLoading, error } = useQuery({
    queryKey: ["compare", slug, idsKey],
    queryFn: () =>
      api.get<CompareResponse>(`/api/events/${slug}/compare?ids=${encodeURIComponent(idsKey)}`),
    enabled: ids.length > 0,
  });
  const { data: gallery } = useQuery({
    queryKey: ["gallery", slug, ""],
    queryFn: () => api.get<GalleryResponse>(`/api/events/${slug}/projects`),
  });

  const current = data?.projects.map((p) => p.id) ?? ids;
  const setIds = (next: string[]) =>
    router.replace(`${pathname}?ids=${next.join(",")}`, { scroll: false });
  const add = (id: string) => setIds([...current.filter((x) => x !== id), id].slice(0, MAX));
  const remove = (id: string) => setIds(current.filter((x) => x !== id));

  const picker = (
    <ProjectPicker
      options={gallery?.projects ?? []}
      exclude={current}
      disabled={current.length >= MAX}
      onPick={add}
    />
  );

  if (ids.length === 0) {
    return (
      <Empty className="border py-20">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GitCompareArrows />
          </EmptyMedia>
          <EmptyTitle>Compare projects side by side</EmptyTitle>
          <EmptyDescription>
            Pick one project and we'll find its closest rivals automatically — or choose up to four
            yourself.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          {picker}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/e/${slug}/projects`} />}
          >
            Browse the gallery
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't compare these projects</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (isLoading || !data) return <CompareSkeleton />;

  const ps = data.projects;
  const cols = ps.length + 1;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Compare projects</h2>
          <p className="text-muted-foreground text-sm">
            {ps.length} projects side by side — scores, judging head-to-heads, content similarity
            and shared tech.
          </p>
        </div>
        {picker}
      </div>

      {data.auto && (
        <Alert>
          <Sparkles />
          <AlertTitle>Auto-picked rivals</AlertTitle>
          <AlertDescription>
            We compared <strong className="text-foreground">{ps[0]?.title}</strong> with the
            submissions most similar in content
            {data.showScores ? " and its neighbours in the ranking" : ""}. Add or remove projects to
            adjust.
          </AlertDescription>
        </Alert>
      )}
      {!data.showScores && (
        <Alert>
          <Lock />
          <AlertTitle>Scores are sealed for now</AlertTitle>
          <AlertDescription>
            Ranks, rubric scores and head-to-head records appear here once the organizers publish
            results. The content comparison below is live already.
          </AlertDescription>
        </Alert>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table
          className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-xl border text-sm [&_tbody_tr:last-child>*]:border-b-0"
          style={{ minWidth: `${11 + ps.length * 13}rem` }}
        >
          <caption className="sr-only">Project comparison</caption>
          <colgroup>
            <col className="w-40 sm:w-44" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="bg-card sticky left-0 z-10 border-b p-3">
                <span className="sr-only">Metric</span>
              </th>
              {ps.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className="bg-card border-b border-l p-3 text-left align-top font-normal"
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="relative">
                      <ProjectCover project={p} className="aspect-[16/9] w-full rounded-lg" />
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        className="bg-background/85 absolute top-2 right-2 backdrop-blur"
                        aria-label={`Remove ${p.title} from comparison`}
                        disabled={ps.length <= 2}
                        onClick={() => remove(p.id)}
                      >
                        <X />
                      </Button>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/e/${slug}/projects/${p.id}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {p.title}
                      </Link>
                      <span className="text-muted-foreground truncate text-xs">
                        {p.teamName ?? "Solo"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.trackName && <Badge variant="secondary">{p.trackName}</Badge>}
                      {p.result?.awards.map((a) => (
                        <Badge key={a.prizeId} className="gap-1">
                          <Award /> {a.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-auto flex gap-1.5">
                      {p.liveUrl && (
                        <Button
                          size="xs"
                          variant="outline"
                          nativeButton={false}
                          render={
                            <a
                              href={p.liveUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                            />
                          }
                        >
                          <ExternalLink /> Demo
                        </Button>
                      )}
                      {p.repoUrl && (
                        <Button
                          size="xs"
                          variant="outline"
                          nativeButton={false}
                          render={
                            <a
                              href={p.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                            />
                          }
                        >
                          <Code2 /> Code
                        </Button>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.showScores && (
              <>
                <GroupLabel cols={cols}>Judging</GroupLabel>
                <Row cols={cols} label="Overall rank" hint="By normalized score">
                  {ps.map((p) => {
                    const best = isBest(
                      ps.map((x) => x.result?.rank ?? null),
                      p.result?.rank ?? null,
                      "min"
                    );
                    return (
                      <Cell key={p.id} best={best}>
                        <span className="text-2xl font-semibold tabular-nums">
                          {p.result?.rank ? `#${p.result.rank}` : "—"}
                        </span>
                        {p.result?.trackRank && (
                          <span className="text-muted-foreground text-xs">
                            #{p.result.trackRank} in track
                          </span>
                        )}
                      </Cell>
                    );
                  })}
                </Row>
                <MetricRow
                  cols={cols}
                  label="Normalized score"
                  hint="Mean of per-judge z-scores, on 1–5"
                  values={ps.map((p) => p.result?.normalized ?? null)}
                  max={SCALE}
                  digits={2}
                  emphasis
                />
                {data.criteria.map((c) => (
                  <MetricRow
                    key={c.key}
                    cols={cols}
                    label={c.label}
                    hint={`Weight ${Math.round(c.weight * 100)}% · mean mark`}
                    values={ps.map((p) => p.result?.criteria[c.key] ?? null)}
                    max={SCALE}
                    digits={1}
                  />
                ))}
                <Row cols={cols} label="Reviews" hint="Judges who scored it">
                  {ps.map((p) => (
                    <Cell key={p.id}>
                      <span className="font-medium tabular-nums">{p.result?.reviews ?? 0}</span>
                    </Cell>
                  ))}
                </Row>

                <GroupLabel cols={cols}>Community & pairwise</GroupLabel>
                <MetricRow
                  cols={cols}
                  label="Community votes"
                  hint="Quadratic tally"
                  values={ps.map((p) => p.result?.votes ?? 0)}
                  max={Math.max(1, ...ps.map((p) => p.result?.votes ?? 0))}
                  digits={0}
                />
                <MetricRow
                  cols={cols}
                  label="Pairwise strength"
                  hint="Bradley–Terry, scaled 1–5"
                  values={ps.map((p) => p.result?.pairwise?.scaled ?? null)}
                  max={SCALE}
                  digits={2}
                  sub={ps.map((p) =>
                    p.result?.pairwise
                      ? `${p.result.pairwise.wins}W – ${p.result.pairwise.losses}L overall`
                      : "No comparisons"
                  )}
                />
                <Row
                  cols={cols}
                  label="Head-to-head"
                  hint="Direct pairwise judgements within this set"
                >
                  {ps.map((p) => (
                    <Cell key={p.id}>
                      <HeadToHead
                        self={p}
                        others={ps.filter((o) => o.id !== p.id)}
                        records={data.headToHead}
                      />
                    </Cell>
                  ))}
                </Row>
              </>
            )}

            <GroupLabel cols={cols}>Content</GroupLabel>
            <Row cols={cols} label="Closest match" hint="Content similarity within this set">
              {ps.map((p, i) => {
                const row = data.similarity[i] ?? [];
                let bestJ = -1;
                for (let j = 0; j < row.length; j++)
                  if (j !== i && (bestJ < 0 || (row[j] ?? 0) > (row[bestJ] ?? 0))) bestJ = j;
                const other = ps[bestJ];
                return (
                  <Cell key={p.id}>
                    {other ? (
                      <>
                        <span className="font-medium tabular-nums">
                          {Math.round((row[bestJ] ?? 0) * 100)}%
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          with {other.title}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Cell>
                );
              })}
            </Row>
            <TagsRow cols={cols} projects={ps} />
          </tbody>
        </table>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section
          title="Content similarity"
          description="How alike the write-ups, taglines and tags are (cosine, TF-IDF)."
        >
          <SimilarityMatrix projects={ps} matrix={data.similarity} />
        </Section>
        <Section title="What each one is about" description="The first lines of each write-up.">
          <div className="flex flex-col gap-3">
            {ps.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border p-3">
                <ProjectCover project={p} size="sm" className="size-10 shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">{p.title}</span>
                  <p className="text-muted-foreground line-clamp-3 text-sm text-pretty">
                    {p.description || p.tagline || "No write-up yet."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function isBest(values: (number | null)[], v: number | null, dir: "max" | "min" = "max") {
  const xs = values.filter((x): x is number => x !== null);
  if (v === null || xs.length < 2) return false;
  const target = dir === "max" ? Math.max(...xs) : Math.min(...xs);
  const distinct = new Set(xs).size > 1;
  return distinct && v === target;
}

function GroupLabel({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <th
        scope="colgroup"
        colSpan={cols}
        className="bg-muted/40 text-muted-foreground border-b px-3 py-1.5 text-left text-xs font-medium tracking-wide uppercase"
      >
        <span className="sticky left-3">{children}</span>
      </th>
    </tr>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  cols: number;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="bg-background sticky left-0 z-10 border-b p-3 text-left align-middle font-normal"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          {hint && <span className="text-muted-foreground text-xs leading-snug">{hint}</span>}
        </div>
      </th>
      {children}
    </tr>
  );
}

function Cell({ best, children }: { best?: boolean; children: React.ReactNode }) {
  return (
    <td className={cn("relative border-b border-l p-3 align-middle", best && "bg-primary/5")}>
      {best && (
        <span className="text-primary absolute top-2 right-2 flex items-center gap-1 text-[0.7rem] font-medium">
          <Crown className="size-3" /> Best
        </span>
      )}
      <div className="flex min-w-0 flex-col justify-center gap-1">{children}</div>
    </td>
  );
}

/** One metric across the set: a value plus a bar on a shared scale, best highlighted. */
function MetricRow({
  cols,
  label,
  hint,
  values,
  max,
  digits,
  emphasis = false,
  sub,
}: {
  cols: number;
  label: string;
  hint?: string;
  values: (number | null)[];
  max: number;
  digits: number;
  emphasis?: boolean;
  sub?: string[];
}) {
  return (
    <Row cols={cols} label={label} hint={hint}>
      {values.map((v, i) => {
        const best = isBest(values, v);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional and stable
          <Cell key={i} best={best}>
            <span
              className={cn("tabular-nums", emphasis ? "text-xl font-semibold" : "font-medium")}
            >
              {v === null ? "—" : formatNumber(v, digits)}
              {v !== null && max === SCALE && (
                <span className="text-muted-foreground text-xs font-normal"> / {SCALE}</span>
              )}
            </span>
            <div
              className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={
                v === null
                  ? "No data"
                  : `${formatNumber(v, digits)} of ${formatNumber(max, digits)}`
              }
            >
              {v !== null && (
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    best ? "bg-chart-1" : "bg-chart-1/45"
                  )}
                  style={{ width: `${Math.max(2, Math.min(100, (v / max) * 100))}%` }}
                />
              )}
            </div>
            {sub?.[i] && <span className="text-muted-foreground text-xs">{sub[i]}</span>}
          </Cell>
        );
      })}
    </Row>
  );
}

function HeadToHead({
  self,
  others,
  records,
}: {
  self: CompareProject;
  others: CompareProject[];
  records: CompareResponse["headToHead"];
}) {
  const lines = others
    .map((o) => ({
      o,
      w: records.filter((r) => r.winnerId === self.id && r.loserId === o.id).length,
      l: records.filter((r) => r.winnerId === o.id && r.loserId === self.id).length,
    }))
    .filter((x) => x.w + x.l > 0);
  if (lines.length === 0)
    return <span className="text-muted-foreground text-xs">Never compared directly</span>;
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {lines.map(({ o, w, l }) => (
        <li key={o.id} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate">vs {o.title}</span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 font-medium tabular-nums",
              w > l
                ? "bg-success/15 text-foreground"
                : w < l
                  ? "bg-destructive/10 text-foreground"
                  : "bg-muted"
            )}
          >
            {w}–{l}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TagsRow({ cols, projects }: { cols: number; projects: CompareProject[] }) {
  const count = new Map<string, number>();
  for (const p of projects)
    for (const t of new Set(p.techTags)) count.set(t, (count.get(t) ?? 0) + 1);
  return (
    <Row cols={cols} label="Tech stack" hint="Filled tags are shared with another project here">
      {projects.map((p) => (
        <Cell key={p.id}>
          {p.techTags.length === 0 ? (
            <span className="text-muted-foreground text-xs">No tags</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {[...p.techTags]
                .sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0))
                .map((t) => {
                  const shared = (count.get(t) ?? 0) > 1;
                  return (
                    <Badge
                      key={t}
                      variant={shared ? "secondary" : "outline"}
                      className={cn(!shared && "text-muted-foreground font-normal")}
                    >
                      {t}
                      {shared && <span className="sr-only"> (shared)</span>}
                    </Badge>
                  );
                })}
            </div>
          )}
        </Cell>
      ))}
    </Row>
  );
}

/** N×N heatmap on one sequential hue (light → dark = less → more alike). */
function SimilarityMatrix({
  projects,
  matrix,
}: {
  projects: CompareProject[];
  matrix: number[][];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">Pairwise content similarity, in percent</caption>
          <thead>
            <tr>
              <th scope="col" className="w-32" />
              {projects.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className="text-muted-foreground max-w-24 truncate p-1 text-center font-medium"
                >
                  {p.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((a, i) => (
              <tr key={a.id}>
                <th
                  scope="row"
                  className="text-muted-foreground max-w-32 truncate pr-2 text-left font-medium"
                >
                  {a.title}
                </th>
                {projects.map((b, j) => {
                  const v = matrix[i]?.[j] ?? 0;
                  const diag = i === j;
                  const pct = Math.round(v * 100);
                  return (
                    <td
                      key={b.id}
                      title={diag ? a.title : `${a.title} ↔ ${b.title}: ${pct}% similar`}
                      className={cn(
                        "h-12 min-w-14 rounded-md text-center font-medium tabular-nums transition-transform hover:scale-[1.04]",
                        diag
                          ? "bg-muted text-muted-foreground"
                          : v >= 0.5
                            ? "text-primary-foreground"
                            : "text-foreground"
                      )}
                      style={
                        diag
                          ? undefined
                          : {
                              background: `color-mix(in oklch, var(--chart-1) ${Math.round(8 + v * 92)}%, var(--muted))`,
                            }
                      }
                    >
                      {diag ? "—" : `${pct}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>Less alike</span>
        <span
          className="h-2 w-32 rounded-full"
          style={{
            background:
              "linear-gradient(to right, color-mix(in oklch, var(--chart-1) 8%, var(--muted)), var(--chart-1))",
          }}
          aria-hidden
        />
        <span>More alike</span>
      </div>
    </div>
  );
}

function ProjectPicker({
  options,
  exclude,
  disabled,
  onPick,
}: {
  options: GalleryResponse["projects"];
  exclude: string[];
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = options.filter((o) => !exclude.includes(o.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" disabled={disabled} />}>
        <Plus /> {disabled ? `Up to ${MAX} projects` : "Add project"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>No matching projects.</CommandEmpty>
            {available.map((o) => (
              <CommandItem
                key={o.id}
                value={`${o.title} ${o.teamName ?? ""} ${o.id}`}
                onSelect={() => {
                  onPick(o.id);
                  setOpen(false);
                }}
              >
                <ProjectCover project={o} size="sm" className="size-7 shrink-0 rounded-md" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{o.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {o.trackName ?? o.teamName ?? ""}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CompareSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
