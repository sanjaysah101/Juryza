"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, GitCompareArrows, LayoutGrid, Search, X } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@juryza/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@juryza/ui/components/ui/select";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { cn } from "@juryza/ui/lib/utils";

import { type GalleryResponse, ProjectCard } from "@/components/project-card";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { useEvent } from "@/lib/queries";

/**
 * The public project gallery of an event: debounced search, track / tech-tag
 * filters and sort, all mirrored in the URL so a filtered view can be shared.
 * "Compare" mode lets a visitor pick 2–4 projects for the side-by-side view.
 */

const galleryKey = (slug: string, params = "") => ["gallery", slug, params] as const;

const MAX_COMPARE = 4;

export default function GalleryPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <Gallery />
    </Suspense>
  );
}

function Gallery() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { data: ev } = useEvent(slug);

  const q = search.get("q") ?? "";
  const trackId = search.get("track") ?? "";
  const tag = search.get("tag") ?? "";
  const sort = search.get("sort") === "title" ? "title" : "newest";

  const [draft, setDraft] = useState(q);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounce typing into the URL (and so into the query).
  useEffect(() => {
    if (draft.trim() === q) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if (draft.trim()) next.set("q", draft.trim());
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, q, pathname, router]);

  const apiParams = new URLSearchParams();
  if (q) apiParams.set("q", q);
  if (trackId) apiParams.set("track", trackId);
  if (tag) apiParams.set("tag", tag);
  if (sort === "title") apiParams.set("sort", "title");
  const qs = apiParams.toString();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: galleryKey(slug, qs),
    queryFn: () => api.get<GalleryResponse>(`/api/events/${slug}/projects${qs ? `?${qs}` : ""}`),
    placeholderData: keepPreviousData,
  });
  // Unfiltered list — the source for tag chips and the names in the compare tray.
  const { data: all } = useQuery({
    queryKey: galleryKey(slug),
    queryFn: () => api.get<GalleryResponse>(`/api/events/${slug}/projects`),
  });

  const tagCounts = new Map<string, number>();
  for (const p of all?.projects ?? [])
    for (const t of p.techTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16);

  const tracks = ev?.tracks ?? [];
  const trackItems = [
    { value: "all", label: "All tracks" },
    ...tracks.map((t) => ({ value: t.id, label: t.name })),
  ];
  const sortItems = [
    { value: "newest", label: "Newest first" },
    { value: "title", label: "A–Z" },
  ];
  const filtered = Boolean(q || trackId || tag);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]
    );
  const titleOf = (id: string) => all?.projects.find((p) => p.id === id)?.title ?? "Project";

  return (
    <div className={cn("flex flex-col gap-6", comparing && "pb-28")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <InputGroup className="md:max-w-sm">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search projects, taglines, write-ups…"
              aria-label="Search projects"
            />
            {draft && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setDraft("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={trackItems}
              value={trackId || "all"}
              onValueChange={(v) => setParams({ track: v && v !== "all" ? String(v) : null })}
            >
              <SelectTrigger aria-label="Filter by track" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trackItems.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={sortItems}
              value={sort}
              onValueChange={(v) => setParams({ sort: v === "title" ? "title" : null })}
            >
              <SelectTrigger aria-label="Sort projects" className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <Button
              variant={comparing ? "secondary" : "outline"}
              aria-pressed={comparing}
              onClick={() => {
                setComparing((c) => !c);
                setSelected([]);
              }}
            >
              {comparing ? <LayoutGrid /> : <GitCompareArrows />}
              {comparing ? "Done comparing" : "Compare"}
            </Button>
          </div>
        </div>

        {tags.length > 0 && (
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Filter by technology</legend>
            {tags.map(([t, n]) => {
              const active = tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParams({ tag: active ? null : t })}
                  className={cn(
                    "focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {t}
                  <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>
                    {n}
                  </span>
                </button>
              );
            })}
          </fieldset>
        )}

        <div
          className="text-muted-foreground flex min-h-6 flex-wrap items-center gap-2 text-sm"
          aria-live="polite"
        >
          {data ? (
            <span>{pluralize(data.count, "project")}</span>
          ) : (
            <Skeleton className="h-4 w-24" />
          )}
          {filtered && (
            <>
              {q && <Badge variant="secondary">“{q}”</Badge>}
              {trackId && (
                <Badge variant="secondary">
                  {tracks.find((t) => t.id === trackId)?.name ?? "Track"}
                </Badge>
              )}
              {tag && <Badge variant="secondary">{tag}</Badge>}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraft("");
                  setParams({ q: null, track: null, tag: null });
                }}
              >
                Clear filters
              </Button>
            </>
          )}
          {comparing && (
            <span className="text-foreground ml-auto">
              Select 2–{MAX_COMPARE} projects to compare side by side.
            </span>
          )}
        </div>
      </div>

      {error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn't load projects</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isLoading || !data ? (
        <GridSkeleton />
      ) : data.projects.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayoutGrid />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No projects match" : "No submissions yet"}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a different search, or clear the filters to see every submission."
                : "Submitted projects appear here as soon as teams hit submit."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft("");
                  setParams({ q: null, track: null, tag: null });
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div
          className={cn(
            "grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            isFetching && "opacity-70"
          )}
        >
          {data.projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              href={`/e/${slug}/projects/${p.id}`}
              selectable={comparing}
              selected={selected.includes(p.id)}
              disabled={selected.length >= MAX_COMPARE}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      {comparing && (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t shadow-lg backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                Compare <span className="tabular-nums">{selected.length}</span>/{MAX_COMPARE}
              </span>
              {selected.length === 0 && (
                <span className="text-muted-foreground text-sm">Tap cards to add them.</span>
              )}
              {selected.map((id) => (
                <Badge key={id} variant="secondary" className="h-6 gap-1 pr-1">
                  <span className="max-w-40 truncate">{titleOf(id)}</span>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${titleOf(id)}`}
                    className="hover:bg-foreground/10 grid size-4 place-items-center rounded-full"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
              >
                Clear
              </Button>
              <Button
                disabled={selected.length < 2}
                onClick={() => router.push(`/e/${slug}/compare?ids=${selected.join(",")}`)}
              >
                Compare {selected.length >= 2 ? selected.length : ""} <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={i} className="flex flex-col gap-3 overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4 pt-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
