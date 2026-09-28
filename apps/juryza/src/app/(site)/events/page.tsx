"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarPlus,
  Compass,
  FolderKanban,
  MapPin,
  Search,
  UsersRound,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@juryza/ui/components/ui/input-group";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@juryza/ui/components/ui/tabs";

import { EventCover, NextMilestone, PhaseBadge } from "@/components/event-bits";
import { useViewer } from "@/components/viewer";
import { api } from "@/lib/api";
import { formatNumber, formatRange } from "@/lib/format";
import { type Phase, phaseOf } from "@/lib/phase";
import { hasAtLeast } from "@/lib/roles";
import type { Event, Json } from "@/lib/types";

/** Explore events: search and filter every published hackathon on this instance. */

type EventRow = Json<Event> & { projectCount: number; participantCount: number };

const FILTERS: { value: "all" | Phase; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submissions", label: "Open for submissions" },
  { value: "judging", label: "Judging" },
  { value: "voting", label: "Voting" },
  { value: "results", label: "Results" },
  { value: "upcoming", label: "Upcoming" },
];

export default function EventsPage() {
  const viewer = useViewer();
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<"all" | Phase>("all");
  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.get<{ events: EventRow[] }>("/api/events"),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.events.length ?? 0 };
    for (const e of data?.events ?? []) {
      const p = phaseOf(e);
      c[p] = (c[p] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const events = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.events ?? []).filter(
      (e) =>
        (phase === "all" || phaseOf(e) === phase) &&
        (!needle ||
          [e.name, e.tagline, e.description, e.location].some((s) =>
            s?.toLowerCase().includes(needle)
          ))
    );
  }, [data, q, phase]);

  return (
    <div className="flex flex-col">
      <section className="bg-muted/30 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-14 pb-8 sm:px-6 sm:pt-20">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="flex flex-col gap-2">
              <p className="text-primary text-sm font-semibold">Explore</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Hackathons on Juryza
              </h1>
              <p className="text-muted-foreground max-w-xl">
                Find an event, register, form a team and ship something in a weekend.
              </p>
            </div>
            {hasAtLeast(viewer?.role, "organizer") && (
              <Button nativeButton={false} render={<Link href="/manage/new" />}>
                <CalendarPlus /> New event
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <InputGroup className="bg-background h-9 lg:max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events, places, themes…"
                aria-label="Search events"
              />
            </InputGroup>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Tabs value={phase} onValueChange={(v) => setPhase(v as "all" | Phase)}>
                <TabsList>
                  {FILTERS.map((f) => (
                    <TabsTrigger key={f.value} value={f.value} className="px-2.5">
                      {f.label}
                      {data && (
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {counts[f.value] ?? 0}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load events</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Empty className="border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Compass />
              </EmptyMedia>
              <EmptyTitle>{data?.events.length ? "No events match" : "No events yet"}</EmptyTitle>
              <EmptyDescription>
                {data?.events.length
                  ? "Try a different search or phase filter."
                  : "When an organizer publishes an event, it shows up here."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {data?.events.length ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setPhase("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button nativeButton={false} render={<Link href="/manage/new" />}>
                  <CalendarPlus /> Host a hackathon
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ e }: { e: EventRow }) {
  return (
    <Link
      href={`/e/${e.slug}`}
      className="group focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
    >
      <Card className="h-full gap-0 py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <EventCover hue={e.hue} className="flex h-28 items-start justify-between gap-2 p-3">
          <PhaseBadge event={e} className="bg-white/15 text-white backdrop-blur" />
          {e.visibility === "draft" && (
            <Badge variant="secondary" className="bg-black/30 text-white">
              Draft
            </Badge>
          )}
        </EventCover>
        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">{e.name}</h2>
            {e.tagline && <p className="text-muted-foreground line-clamp-2 text-sm">{e.tagline}</p>}
          </div>
          <div className="text-muted-foreground flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" />{" "}
              {formatRange(e.submissionsOpen, e.submissionsClose)}
            </span>
            <span className="flex items-center gap-2 capitalize">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">{e.location ? `${e.mode} · ${e.location}` : e.mode}</span>
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5" title="Participants">
                <UsersRound className="text-muted-foreground size-4" />
                <span className="font-medium tabular-nums">{formatNumber(e.participantCount)}</span>
              </span>
              <span className="flex items-center gap-1.5" title="Submitted projects">
                <FolderKanban className="text-muted-foreground size-4" />
                <span className="font-medium tabular-nums">{formatNumber(e.projectCount)}</span>
              </span>
            </div>
            <NextMilestone event={e} className="truncate text-xs" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
