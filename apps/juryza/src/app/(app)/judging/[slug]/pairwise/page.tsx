"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Eye,
  Flame,
  FolderGit2,
  Globe,
  Info,
  PartyPopper,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Undo2,
  Video,
  Zap,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@juryza/ui/components/ui/dialog";
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

import { RichContent } from "@/components/editor/rich-content";
import { coverStyle } from "@/components/event-bits";
import { api } from "@/lib/api";
import type { RichDoc } from "@/lib/db/schema";
import { formatDate, hueOf } from "@/lib/format";
import { parseRichDoc } from "@/lib/rich-text";

interface PairProject {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  content: RichDoc | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  techTags: string[];
  trackName: string | null;
}

interface RecentComparison {
  id: string;
  winnerId: string;
  winnerTitle: string;
  winnerThumb: string | null;
  loserId: string;
  loserTitle: string;
  loserThumb: string | null;
  createdAt: string;
}

interface MatchupInfo {
  gap: number;
  isClose: boolean;
  informationGain: "High" | "Medium" | "Standard";
}

interface PairData {
  event: { slug: string; name: string };
  pair: [PairProject, PairProject] | null;
  matchup?: MatchupInfo | null;
  recent?: RecentComparison[];
  progress: { compared: number; possible: number };
}

export default function PairwisePage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const key = ["judge", "pairwise", slug];

  const [skipped, setSkipped] = useState<string[]>([]);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [inspectingProject, setInspectingProject] = useState<PairProject | null>(null);
  const [selectedSide, setSelectedSide] = useState<0 | 1 | null>(null);

  const skipQuery = skipped.length ? `?skip=${encodeURIComponent(skipped.join(","))}` : "";
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [...key, skipped.join(",")],
    queryFn: () =>
      api.get<PairData>(`/api/events/${encodeURIComponent(slug)}/pairwise${skipQuery}`),
  });

  const vote = useMutation({
    mutationFn: (v: { winnerId: string; loserId: string }) =>
      api.post(`/api/events/${encodeURIComponent(slug)}/pairwise`, v),
    onSuccess: () => {
      setSelectedSide(null);
      const nextStreak = sessionStreak + 1;
      setSessionStreak(nextStreak);
      if (nextStreak === 5) {
        toast.success("🔥 5 verdicts in a row! Model strengths converging rapidly.", {
          duration: 3500,
        });
      } else if (nextStreak === 10) {
        toast.success("⚡ 10 verdicts! Super-judge calibration achieved.", {
          duration: 4000,
        });
      } else {
        toast.success("Verdict recorded · Bradley–Terry model updated", { duration: 1800 });
      }
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => {
      setSelectedSide(null);
      toast.error(e.message);
    },
  });

  const undo = useMutation({
    mutationFn: () => api.delete(`/api/events/${encodeURIComponent(slug)}/pairwise`),
    onSuccess: () => {
      toast.success("Previous verdict reversed");
      setSessionStreak((s) => Math.max(0, s - 1));
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e.message),
  });

  const pair = data?.pair ?? null;
  const busy = vote.isPending || undo.isPending || isFetching;

  const choose = (side: 0 | 1) => {
    if (!pair || busy) return;
    setSelectedSide(side);
    const winner = pair[side];
    const loser = pair[side === 0 ? 1 : 0];
    vote.mutate({ winnerId: winner.id, loserId: loser.id });
  };

  const skipMatchup = () => {
    if (!pair || busy) return;
    const pairSignature = `${pair[0].id}|${pair[1].id}`;
    setSkipped((prev) => [...prev, pairSignature]);
    toast.info("Matchup skipped · Loaded next candidate pair");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || ["INPUT", "TEXTAREA"].includes(t.tagName))
      )
        return;

      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        choose(0);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        choose(1);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skipMatchup();
      } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
        if (data?.recent && data.recent.length > 0 && !busy) {
          e.preventDefault();
          undo.mutate();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          href={`/judging/${slug}`}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to scoring console
        </Link>
        <div className="mt-1 flex items-center gap-2.5">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            Pairwise Duel Arena
          </h1>
          {data && (
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary font-semibold"
            >
              {data.event.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {sessionStreak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 shadow-xs">
            <Flame className="size-3.5 fill-amber-500 animate-pulse" />
            <span className="tabular-nums">{sessionStreak}</span> streak
          </div>
        )}
        {data?.recent && data.recent.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => undo.mutate()}
            disabled={busy}
            className="text-xs gap-1.5"
            title="Undo previous comparison"
          >
            <Undo2 className="size-3.5" /> Undo last <Kbd className="text-[10px]">Z</Kbd>
          </Button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[460px] rounded-2xl" />
          <Skeleton className="h-[460px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>Pairwise arena unavailable</EmptyTitle>
            <EmptyDescription>
              {error?.message ?? "You may not be on this event's judging panel."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const { compared, possible } = data.progress;
  const pct = possible ? Math.min(100, Math.round((compared / possible) * 100)) : 0;
  const matchup = data.matchup;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {header}

      {/* Progress & calibration metrics */}
      <Card className="border-border/60 bg-gradient-to-r from-card via-background to-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Scale className="text-primary size-4" />
              <span className="font-semibold text-foreground">Judge Progress</span>
              <span className="text-muted-foreground text-xs">
                (Adaptive Bradley–Terry Active Sampling)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold tabular-nums text-muted-foreground sm:text-right">
              <span>{compared} completed</span>
              <span>·</span>
              <span className="text-foreground">{possible - compared} remaining</span>
              <span>·</span>
              <span className="text-primary">{pct}% calibrated</span>
            </div>
          </div>
          <Progress value={pct} className="h-2 rounded-full" aria-label="Comparisons made" />
        </div>
      </Card>

      {/* Main Duel Stage */}
      {pair ? (
        <div className="flex flex-col gap-6">
          {/* Matchup Header Banner */}
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <div className="flex items-center gap-2">
              {matchup?.isClose ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-500 gap-1.5 px-3 py-1 font-semibold text-xs shadow-xs"
                >
                  <Zap className="size-3.5 fill-amber-500" /> High-Value Matchup · Closest
                  Contenders
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-indigo-500/40 bg-indigo-500/10 text-indigo-400 gap-1.5 px-3 py-1 font-semibold text-xs"
                >
                  <Sparkles className="size-3.5" /> Active Information Sampling
                </Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Which project demonstrates stronger execution & impact?
            </h2>
            <p className="text-muted-foreground max-w-xl text-xs sm:text-sm">
              Evaluate innovation, technical craft, and user experience. Tap cards or use{" "}
              <Kbd>A</Kbd> / <Kbd>←</Kbd> for Left and <Kbd>D</Kbd> / <Kbd>→</Kbd> for Right.
            </p>
          </div>

          {/* Cards Arena Grid with central VS element */}
          <div className="relative">
            <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
              {/* Contender A */}
              <ContenderCard
                project={pair[0]}
                sideLabel="A"
                hotkey="A / ←"
                accentColor="indigo"
                opponentTags={pair[1].techTags}
                isSelected={selectedSide === 0}
                isLosing={selectedSide === 1}
                disabled={busy}
                onSelect={() => choose(0)}
                onInspect={() => setInspectingProject(pair[0])}
              />

              {/* Contender B */}
              <ContenderCard
                project={pair[1]}
                sideLabel="B"
                hotkey="D / →"
                accentColor="rose"
                opponentTags={pair[0].techTags}
                isSelected={selectedSide === 1}
                isLosing={selectedSide === 0}
                disabled={busy}
                onSelect={() => choose(1)}
                onInspect={() => setInspectingProject(pair[1])}
              />
            </div>

            {/* Central VS Emblem Overlay for Desktop */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center justify-center z-20">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 p-0.5 shadow-2xl shadow-purple-500/30">
                <div className="flex size-full items-center justify-center rounded-[14px] bg-background/95 backdrop-blur-md">
                  <span className="font-black italic tracking-wider text-base bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                    VS
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Arena Action Bar: Skip & Hotkey Guide */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 p-3 sm:px-5">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Hotkeys:</span>
              <span>
                <Kbd>A</Kbd> or <Kbd>←</Kbd> Pick Left
              </span>
              <span>·</span>
              <span>
                <Kbd>D</Kbd> or <Kbd>→</Kbd> Pick Right
              </span>
              <span>·</span>
              <span>
                <Kbd>S</Kbd> Skip
              </span>
              <span>·</span>
              <span>
                <Kbd>Ctrl+Z</Kbd> Undo
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={skipMatchup}
              disabled={busy}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Skip pair <Kbd className="text-[10px]">S</Kbd>
            </Button>
          </div>
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PartyPopper className="text-primary" />
            </EmptyMedia>
            <EmptyTitle>
              {possible === 0 ? "Not enough projects to compare" : "All Caught Up! Arena Clear"}
            </EmptyTitle>
            <EmptyDescription>
              {possible === 0
                ? "Pairwise mode needs at least two projects assigned to your judging panel."
                : "You have reviewed all available active pairs. Your head-to-head verdicts have been mathematically mapped to the global leaderboard."}
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

      {/* Recent Verdicts Feed */}
      {data.recent && data.recent.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" /> Recent Verdicts ({data.recent.length})
            </h3>
            <span className="text-muted-foreground text-xs">Direct impact on global ranking</span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3 text-xs shadow-2xs"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="font-semibold text-emerald-500 truncate max-w-[110px]"
                    title={r.winnerTitle}
                  >
                    {r.winnerTitle}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">beat</span>
                  <span
                    className="text-muted-foreground truncate max-w-[110px]"
                    title={r.loserTitle}
                  >
                    {r.loserTitle}
                  </span>
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {formatDate(r.createdAt, { hour: "numeric", minute: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Educational Accordion */}
      <Collapsible className="bg-card/40 rounded-xl border border-border/60">
        <CollapsibleTrigger className="group/c flex w-full items-center gap-2 px-5 py-3.5 text-left text-sm font-medium transition-colors hover:text-foreground">
          <Info className="text-muted-foreground size-4" />
          The Science of Pairwise Mode & Bradley–Terry Modeling
          <ChevronDown className="text-muted-foreground ml-auto size-4 transition-transform group-data-panel-open/c:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="text-muted-foreground flex flex-col gap-3 px-5 pb-5 text-sm leading-relaxed">
          <p>
            Unlike absolute 1–5 rubrics where judges often drift between lenient and harsh marking,
            head-to-head comparisons eliminate calibration bias. Human judgment is scientifically
            proven to be most reliable when answering binary comparative questions:{" "}
            <em>“Which of these two is better?”</em>
          </p>
          <p>
            Verdicts are dynamically synthesized using an iterative{" "}
            <strong className="text-foreground">Bradley–Terry maximum likelihood model</strong>. The
            algorithm calculates an intrinsic continuous strength latent variable for every project,
            normalizing away judge biases and automatically converging into a resilient global
            podium ranking.
          </p>
        </CollapsibleContent>
      </Collapsible>

      {/* Deep-Dive Project Inspection Modal */}
      {inspectingProject && (
        <Dialog open={true} onOpenChange={() => setInspectingProject(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {inspectingProject.trackName && (
                  <Badge variant="outline" className="text-xs">
                    {inspectingProject.trackName}
                  </Badge>
                )}
                {inspectingProject.techTags.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-[11px]">
                    {t}
                  </Badge>
                ))}
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold">
                {inspectingProject.title}
              </DialogTitle>
              {inspectingProject.tagline && (
                <DialogDescription className="text-sm font-medium text-foreground/80">
                  {inspectingProject.tagline}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex flex-col gap-5 py-2">
              {inspectingProject.thumbnailUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border">
                  {/* biome-ignore lint/performance/noImgElement: user-supplied thumbnail */}
                  <img
                    src={inspectingProject.thumbnailUrl}
                    alt={inspectingProject.title}
                    className="size-full object-cover"
                  />
                </div>
              )}

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                {inspectingProject.repoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={inspectingProject.repoUrl} target="_blank" rel="noreferrer" />}
                  >
                    <FolderGit2 className="size-4" /> View Codebase{" "}
                    <ExternalLink className="size-3" />
                  </Button>
                )}
                {inspectingProject.liveUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={inspectingProject.liveUrl} target="_blank" rel="noreferrer" />}
                  >
                    <Globe className="size-4" /> Open Live Demo <ExternalLink className="size-3" />
                  </Button>
                )}
                {inspectingProject.videoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={inspectingProject.videoUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    <Video className="size-4" /> Watch Demo Video{" "}
                    <ExternalLink className="size-3" />
                  </Button>
                )}
              </div>

              {/* Rich Writeup Content */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Project Overview & Writeup</h4>
                {inspectingProject.content ? (
                  <RichContent doc={parseRichDoc(inspectingProject.content)} />
                ) : inspectingProject.description ? (
                  <p className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">
                    {inspectingProject.description}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">No writeup provided.</p>
                )}
              </div>

              {/* Tech Stack */}
              {inspectingProject.techTags.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-2">Technologies Used</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingProject.techTags.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setInspectingProject(null)}>
                Close Preview
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ContenderCard({
  project: p,
  sideLabel,
  hotkey,
  accentColor,
  opponentTags,
  isSelected,
  isLosing,
  disabled,
  onSelect,
  onInspect,
}: {
  project: PairProject;
  sideLabel: "A" | "B";
  hotkey: string;
  accentColor: "indigo" | "rose";
  opponentTags: string[];
  isSelected: boolean;
  isLosing: boolean;
  disabled: boolean;
  onSelect: () => void;
  onInspect: () => void;
}) {
  const hue = hueOf(p.id);
  const isIndigo = accentColor === "indigo";

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all duration-300 border-2",
        isSelected &&
          "ring-4 ring-emerald-500 border-emerald-500 scale-[1.01] shadow-xl shadow-emerald-500/10 z-10",
        isLosing && "opacity-40 grayscale-[25%] scale-[0.99]",
        !isSelected &&
          !isLosing &&
          (isIndigo
            ? "hover:border-indigo-500/80 hover:shadow-lg hover:shadow-indigo-500/10"
            : "hover:border-rose-500/80 hover:shadow-lg hover:shadow-rose-500/10")
      )}
    >
      {/* Contender Banner / Cover */}
      <div
        className="relative h-40 sm:h-44 w-full overflow-hidden"
        style={p.thumbnailUrl ? undefined : coverStyle(hue)}
      >
        {p.thumbnailUrl && (
          // biome-ignore lint/performance/noImgElement: arbitrary user-supplied URL
          <img
            src={p.thumbnailUrl}
            alt={p.title}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Side Tag Badge */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl font-black text-sm text-white shadow-lg backdrop-blur-md",
              isIndigo ? "bg-indigo-600/90" : "bg-rose-600/90"
            )}
          >
            {sideLabel}
          </span>
          {p.trackName && (
            <Badge variant="secondary" className="backdrop-blur-md bg-background/80 font-medium">
              {p.trackName}
            </Badge>
          )}
        </div>

        {/* Hotkey Indicator */}
        <div className="absolute top-3.5 right-3.5">
          <span className="flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
            Key <Kbd className="text-[10px]">{hotkey}</Kbd>
          </span>
        </div>
      </div>

      {/* Contender Body */}
      <CardContent className="flex flex-1 flex-col gap-4 p-5 sm:p-6 -mt-6 z-10">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {p.title}
          </h3>
          {p.tagline ? (
            <p className="text-muted-foreground text-sm font-medium line-clamp-2">{p.tagline}</p>
          ) : (
            <p className="text-muted-foreground text-xs italic">No tagline provided</p>
          )}
        </div>

        {/* Tech Stack Comparison Pills */}
        {p.techTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.techTags.slice(0, 6).map((t) => {
              const isShared = opponentTags.includes(t);
              return (
                <Badge
                  key={t}
                  variant={isShared ? "secondary" : "outline"}
                  className={cn(
                    "text-[11px] font-medium transition-colors",
                    !isShared &&
                      (isIndigo
                        ? "border-indigo-500/40 text-indigo-400"
                        : "border-rose-500/40 text-rose-400")
                  )}
                  title={isShared ? "Shared technology with opponent" : "Unique technology"}
                >
                  {t}
                </Badge>
              );
            })}
            {p.techTags.length > 6 && (
              <span className="text-muted-foreground text-[11px] self-center">
                +{p.techTags.length - 6} more
              </span>
            )}
          </div>
        )}

        {/* Brief Description */}
        {p.description && (
          <p className="text-muted-foreground text-xs line-clamp-3 leading-relaxed">
            {p.description}
          </p>
        )}

        {/* Secondary Links & Inspect Trigger */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button
            variant="ghost"
            size="xs"
            onClick={onInspect}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <Eye className="size-3.5 text-primary" /> Full Write-up
          </Button>

          <div className="flex items-center gap-1.5">
            {p.repoUrl && (
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<a href={p.repoUrl} target="_blank" rel="noreferrer" />}
                className="text-xs"
                title="GitHub Repository"
              >
                <FolderGit2 className="size-3.5" />
              </Button>
            )}
            {p.liveUrl && (
              <Button
                variant="ghost"
                size="xs"
                nativeButton={false}
                render={<a href={p.liveUrl} target="_blank" rel="noreferrer" />}
                className="text-xs"
                title="Live Application Demo"
              >
                <Globe className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Hero Vote Button */}
        <Button
          size="lg"
          className={cn(
            "h-12 w-full text-base font-semibold transition-all duration-200 shadow-md",
            isIndigo
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
          )}
          onClick={onSelect}
          disabled={disabled}
        >
          {disabled ? (
            <Spinner className="size-4" />
          ) : (
            <>
              {sideLabel === "A" && <ArrowLeft className="mr-1.5 size-4" />}
              <span>Pick Project {sideLabel} as Winner</span>
              {sideLabel === "B" && <ArrowRight className="ml-1.5 size-4" />}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
