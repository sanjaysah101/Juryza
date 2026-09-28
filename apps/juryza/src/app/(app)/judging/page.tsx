"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, CheckCircle2, Gavel, Lock, Shuffle } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Progress } from "@juryza/ui/components/ui/progress";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { EventCover } from "@/components/event-bits";
import { PageHeader, StatCard } from "@/components/page";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";

/**
 * Judging queue: every event whose panel the viewer sits on, with their own
 * review progress and the judging deadline, and a way into the scoring
 * console or pairwise mode.
 */

interface QueueEvent {
  id: string;
  slug: string;
  name: string;
  hue: number;
  judgingClose: string | null;
  submissionsClose: string;
  resultsPublished: boolean;
  assigned: number;
  scored: number;
}

export default function JudgingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["judge", "queue"],
    queryFn: () => api.get<{ events: QueueEvent[] }>("/api/judge/queue"),
  });
  const events = data?.events ?? [];
  const assigned = events.reduce((n, e) => n + e.assigned, 0);
  const scored = events.reduce((n, e) => n + Math.min(e.scored, e.assigned), 0);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Judging queue"
        description="Projects assigned to you, event by event. Your scores are private to you and the organizers."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Panels" value={isLoading ? "…" : events.length} icon={Gavel} />
        <StatCard label="Assigned" value={isLoading ? "…" : assigned} />
        <StatCard label="Reviewed" value={isLoading ? "…" : scored} icon={CheckCircle2} />
        <StatCard
          label="To do"
          value={isLoading ? "…" : assigned - scored}
          hint={assigned ? `${Math.round((scored / assigned) * 100)}% done` : undefined}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn't load your queue</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : events.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gavel />
            </EmptyMedia>
            <EmptyTitle>You're not on a judging panel</EmptyTitle>
            <EmptyDescription>
              When an organizer invites you to judge, the event shows up here with your assignments.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((e) => {
            const done = Math.min(e.scored, e.assigned);
            const pct = e.assigned ? Math.round((done / e.assigned) * 100) : 0;
            const closes = e.judgingClose ? new Date(e.judgingClose).getTime() : null;
            const locked = e.resultsPublished || (closes !== null && closes <= now);
            const complete = e.assigned > 0 && done >= e.assigned;
            return (
              <Card key={e.id} className="flex-col gap-0 overflow-hidden py-0 sm:flex-row">
                <EventCover hue={e.hue} className="h-16 shrink-0 sm:h-auto sm:w-28" />
                <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{e.name}</h3>
                      {locked ? (
                        <Badge variant="secondary">
                          <Lock /> {e.resultsPublished ? "Results published" : "Judging closed"}
                        </Badge>
                      ) : complete ? (
                        <Badge>
                          <CheckCircle2 /> All reviewed
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={pct}
                        className="flex-1"
                        aria-label={`${done} of ${e.assigned} reviewed`}
                      />
                      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        {done} of {e.assigned} reviewed
                      </span>
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <CalendarClock className="size-3.5" />
                      {closes === null
                        ? "No judging deadline set"
                        : closes > now
                          ? `Judging closes ${relativeTime(closes, now)} · ${formatDateTime(closes)}`
                          : `Judging closed ${formatDateTime(closes)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/judging/${e.slug}/pairwise`} />}
                    >
                      <Shuffle /> Pairwise mode
                    </Button>
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/judging/${e.slug}`} />}
                    >
                      {e.assigned === 0
                        ? "Open console"
                        : done === 0
                          ? "Start reviewing"
                          : complete || locked
                            ? "Review scores"
                            : "Continue reviewing"}
                      <ArrowRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
