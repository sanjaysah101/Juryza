"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  FolderGit2,
  Globe,
  Info,
  PartyPopper,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@juryza/ui/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Kbd } from "@juryza/ui/components/ui/kbd";
import { Progress } from "@juryza/ui/components/ui/progress";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { cn } from "@juryza/ui/lib/utils";

import { coverStyle } from "@/components/event-bits";
import { api } from "@/lib/api";
import { hueOf } from "@/lib/format";

/**
 * Pairwise judging: two of the judge's assigned projects side by side, one
 * question — which is stronger overall? Pairs are chosen actively by the API
 * (Bradley–Terry), so each answer is as informative as possible. ← / → pick.
 */

interface PairProject {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  techTags: string[];
  trackName: string | null;
}

interface PairData {
  event: { slug: string; name: string };
  pair: [PairProject, PairProject] | null;
  progress: { compared: number; possible: number };
}

export default function PairwisePage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const key = ["judge", "pairwise", slug];
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => api.get<PairData>(`/api/events/${encodeURIComponent(slug)}/pairwise`),
  });

  const vote = useMutation({
    mutationFn: (v: { winnerId: string; loserId: string }) =>
      api.post(`/api/events/${encodeURIComponent(slug)}/pairwise`, v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(e.message),
  });

  const pair = data?.pair ?? null;
  const busy = vote.isPending || isFetching;

  const choose = (side: 0 | 1) => {
    if (!pair || busy) return;
    const winner = pair[side];
    const loser = pair[side === 0 ? 1 : 0];
    vote.mutate({ winnerId: winner.id, loserId: loser.id });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || ["INPUT", "TEXTAREA"].includes(t.tagName))
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        choose(0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        choose(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Link
          href={`/judging/${slug}`}
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-3.5" /> Scoring console
        </Link>
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          Pairwise mode{data ? ` · ${data.event.name}` : ""}
        </h1>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {header}
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>Pairwise mode unavailable</EmptyTitle>
            <EmptyDescription>
              {error?.message ?? "You may not be on this event's judging panel."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const { compared, possible } = data.progress;
  const pct = possible ? Math.min(100, Math.round((compared / possible) * 100)) : 0;

  return (
    <>
      {header}

      <div className="flex items-center gap-3">
        <Progress value={pct} className="flex-1" aria-label="Comparisons made" />
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {compared} of {possible} pairs compared
        </span>
      </div>

      {pair ? (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold tracking-tight">Which is stronger overall?</h2>
            <p className="text-muted-foreground text-sm">
              Go with your gut — there's no rubric here. Press <Kbd>←</Kbd> or <Kbd>→</Kbd>.
            </p>
          </div>
          <div className={cn("grid gap-4 transition-opacity md:grid-cols-2", busy && "opacity-60")}>
            {pair.map((p, i) => (
              <PairCard
                key={p.id}
                project={p}
                side={i === 0 ? "A" : "B"}
                disabled={busy}
                onChoose={() => choose(i === 0 ? 0 : 1)}
              />
            ))}
          </div>
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PartyPopper />
            </EmptyMedia>
            <EmptyTitle>
              {possible === 0 ? "Not enough projects to compare" : "You're all caught up"}
            </EmptyTitle>
            <EmptyDescription>
              {possible === 0
                ? "Pairwise mode needs at least two projects assigned to you."
                : "There are no more informative pairs for you right now. Thanks — your comparisons feed the ranking."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/judging/${slug}`} />}
            >
              Back to scoring console
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <Collapsible className="bg-muted/40 rounded-lg border">
        <CollapsibleTrigger className="group/c flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
          <Info className="text-muted-foreground size-4" />
          How pairs are chosen
          <ChevronDown className="text-muted-foreground ml-auto size-4 transition-transform group-data-panel-open/c:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground flex flex-col gap-2 px-4 pb-4 text-sm">
          <p>
            Every verdict from every judge feeds a{" "}
            <strong className="text-foreground">Bradley–Terry model</strong>, which estimates each
            project's strength from who-beat-whom. People are better at comparing two things than at
            giving absolute marks, and comparisons cancel out judges who score hot or cold.
          </p>
          <p>
            Pairing is <strong className="text-foreground">active</strong>: you're shown two
            projects you haven't compared whose current strengths are closest — the match-up whose
            outcome is least certain, so each answer carries the most information. You never have to
            compare every possible pair.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

function PairCard({
  project: p,
  side,
  disabled,
  onChoose,
}: {
  project: PairProject;
  side: "A" | "B";
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative h-28" style={p.thumbnailUrl ? undefined : coverStyle(hueOf(p.id))}>
        {p.thumbnailUrl && (
          // biome-ignore lint/performance/noImgElement: arbitrary user-supplied URL
          <img src={p.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <span className="bg-background/90 text-foreground absolute top-3 left-3 grid size-8 place-items-center rounded-full text-sm font-semibold shadow-sm">
          {side}
        </span>
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          {p.trackName && (
            <Badge variant="secondary" className="w-fit">
              {p.trackName}
            </Badge>
          )}
          <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
          {p.tagline && <p className="text-muted-foreground text-sm">{p.tagline}</p>}
        </div>
        {p.techTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.techTags.slice(0, 8).map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}
        {p.description && <p className="line-clamp-6 text-sm text-pretty">{p.description}</p>}
        {(p.repoUrl || p.liveUrl) && (
          <div className="flex flex-wrap gap-2">
            {p.repoUrl && (
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<a href={p.repoUrl} target="_blank" rel="noreferrer" />}
              >
                <FolderGit2 /> Repository <ExternalLink />
              </Button>
            )}
            {p.liveUrl && (
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<a href={p.liveUrl} target="_blank" rel="noreferrer" />}
              >
                <Globe /> Live demo <ExternalLink />
              </Button>
            )}
          </div>
        )}
        <Button
          size="lg"
          className="mt-auto h-12 w-full text-base"
          onClick={onChoose}
          disabled={disabled}
        >
          {disabled ? <Spinner /> : side === "A" ? <ArrowLeft /> : null}
          {side} is stronger
          {!disabled && side === "B" && <ArrowRight />}
        </Button>
      </CardContent>
    </Card>
  );
}
