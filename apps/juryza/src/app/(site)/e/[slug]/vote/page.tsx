"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Info, LogIn, MailCheck, Search, Shuffle, Vote } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@juryza/ui/components/ui/input-group";
import { Progress } from "@juryza/ui/components/ui/progress";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { cn } from "@juryza/ui/lib/utils";

import {
  type Ballot,
  ballotKey,
  ProjectCover,
  TagChips,
  useBallot,
  useCastVote,
  VoteStepper,
} from "@/components/project-card";
import { api } from "@/lib/api";
import { formatDateTime, pluralize, relativeTime } from "@/lib/format";
import { voteCost } from "@/lib/voting";

/**
 * The community ballot. Quadratic voting: each voter has a credit budget and n
 * votes on one project cost n² credits. Projects come in an order shuffled per
 * voter; only the voter's own allocations are ever shown — never tallies.
 * Access depends on the event: signed-in users, verified emails, or anyone.
 */

export default function VotePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: ballot, isLoading, error } = useBallot(slug);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load the ballot</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (isLoading || !ballot) return <BallotSkeleton />;

  if (!ballot.enabled) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Vote />
          </EmptyMedia>
          <EmptyTitle>No community vote for this event</EmptyTitle>
          <EmptyDescription>The winners here are decided by the judging panel.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!ballot.open) {
    const opens =
      ballot.event.votingOpen && new Date(ballot.event.votingOpen).getTime() > Date.now();
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClock />
          </EmptyMedia>
          <EmptyTitle>{opens ? "Voting hasn't opened yet" : "Voting has closed"}</EmptyTitle>
          <EmptyDescription>
            {opens
              ? `The ballot opens ${relativeTime(ballot.event.votingOpen)} — ${formatDateTime(ballot.event.votingOpen)}.`
              : `The community vote ended ${formatDateTime(ballot.event.votingClose)}. Tallies are revealed with the results.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/e/${slug}/projects`} />}
          >
            Browse projects
          </Button>
          {!opens && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/e/${slug}/leaderboard`} />}
            >
              Leaderboard
            </Button>
          )}
        </EmptyContent>
      </Empty>
    );
  }

  if (ballot.voter.status === "sign-in") {
    const next = encodeURIComponent(`/e/${slug}/vote`);
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LogIn />
          </EmptyMedia>
          <EmptyTitle>Sign in to vote</EmptyTitle>
          <EmptyDescription>
            This event's community vote is open to registered accounts, so every ballot belongs to a
            real person. You get {ballot.budget} credits to spread across the projects you like.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button nativeButton={false} render={<Link href={`/login?next=${next}`} />}>
            Sign in
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/signup?next=${next}`} />}
          >
            Create an account
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (ballot.voter.status === "verify-email") return <VerifyEmail slug={slug} ballot={ballot} />;

  return <ReadyBallot slug={slug} ballot={ballot} label={ballot.voter.label} />;
}

function ReadyBallot({ slug, ballot, label }: { slug: string; ballot: Ballot; label: string }) {
  const cast = useCastVote(slug);
  const [q, setQ] = useState("");
  const remaining = ballot.budget - ballot.spent;
  const pct = Math.min(100, (ballot.spent / Math.max(1, ballot.budget)) * 100);
  const backed = ballot.projects.filter((p) => p.myVotes > 0).length;
  const needle = q.trim().toLowerCase();
  const list = needle
    ? ballot.projects.filter((p) =>
        [p.title, p.tagline ?? "", p.trackName ?? "", ...p.techTags].some((s) =>
          s.toLowerCase().includes(needle)
        )
      )
    : ballot.projects;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Your ballot</h2>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Shuffle className="size-3.5" /> Order is randomized for each voter, so no project
              benefits from being first.
            </p>
          </div>
          <InputGroup className="sm:max-w-60">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter projects"
              aria-label="Filter projects"
            />
          </InputGroup>
        </div>

        {list.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>
                {ballot.projects.length ? "No projects match" : "No projects to vote on yet"}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((p) => (
              <li
                key={p.id}
                className={cn(
                  "bg-card flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center",
                  p.myVotes > 0 && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ProjectCover project={p} size="sm" className="size-14 shrink-0 rounded-lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/e/${slug}/projects/${p.id}`}
                        target="_blank"
                        rel="noopener"
                        className="truncate font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                      {p.trackName && <Badge variant="secondary">{p.trackName}</Badge>}
                      {p.ownTeam && <Badge variant="outline">Your team</Badge>}
                    </div>
                    {p.tagline && (
                      <p className="text-muted-foreground line-clamp-1 text-sm">{p.tagline}</p>
                    )}
                    <TagChips tags={p.techTags} className="hidden sm:flex" />
                  </div>
                </div>
                <VoteStepper
                  title={p.title}
                  votes={p.myVotes}
                  max={ballot.maxVotesPerProject}
                  remaining={remaining + voteCost(p.myVotes)}
                  disabled={p.ownTeam}
                  disabledReason={
                    p.ownTeam ? "You can't vote for your own team's project" : undefined
                  }
                  onChange={(votes) => cast.mutate({ projectId: p.id, votes })}
                  className="self-end sm:self-auto"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
        <Card className="gap-4">
          <CardHeader>
            <CardDescription>Voting as {label}</CardDescription>
            <CardTitle className="flex items-baseline gap-1.5 text-3xl">
              {remaining}
              <span className="text-muted-foreground text-sm font-normal">
                of {ballot.budget} credits left
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress
              value={pct}
              aria-label={`${ballot.spent} of ${ballot.budget} credits spent`}
              className="[&_[data-slot=progress-track]]:bg-primary/15 [&_[data-slot=progress-track]]:h-2"
            />
            <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
              <span>{ballot.spent} spent</span>
              <span>{pluralize(backed, "project")} backed</span>
            </div>
            <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3 text-xs">
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                <Info className="size-3.5" /> Quadratic voting
              </span>
              <span className="text-muted-foreground">
                n votes on one project cost n² credits — show how strongly you feel, but spreading
                support goes further.
              </span>
              <div className="grid grid-cols-4 gap-1 text-center tabular-nums">
                {Array.from(
                  { length: Math.min(4, ballot.maxVotesPerProject) },
                  (_, i) => i + 1
                ).map((n) => (
                  <div key={n} className="bg-background rounded-md border px-1 py-1.5">
                    <div className="text-foreground font-semibold">{n}</div>
                    <div className="text-muted-foreground">{voteCost(n)} cr</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Changes save instantly. Tallies stay hidden until results are published
              {ballot.event.votingClose
                ? ` — voting closes ${formatDateTime(ballot.event.votingClose)}`
                : ""}
              .
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function VerifyEmail({ slug, ballot }: { slug: string; ballot: Ballot }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const domains = ballot.allowedDomains.map((d) => `@${d.replace(/^@/, "")}`);

  const request = useMutation({
    mutationFn: () => api.post(`/api/events/${slug}/voters`, { email }),
    onSuccess: () => {
      setSent(true);
      toast.success("Code sent — check your inbox");
    },
    onError: (e) => toast.error(e.message),
  });
  const verify = useMutation({
    mutationFn: () => api.post(`/api/events/${slug}/voters`, { email, code }),
    onSuccess: () => {
      toast.success("Email verified — happy voting!");
      qc.invalidateQueries({ queryKey: ballotKey(slug) });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6">
      <Card>
        <CardHeader>
          <span className="bg-primary/10 text-primary mb-2 grid size-10 place-items-center rounded-lg">
            <MailCheck className="size-5" />
          </span>
          <CardTitle>Verify your email to vote</CardTitle>
          <CardDescription>
            One ballot per address. We'll send a 6-digit code
            {domains.length ? ` — voting is open to ${domains.join(", ")} addresses` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                request.mutate();
              }}
            >
              <Field>
                <FieldLabel htmlFor="voter-email">Email address</FieldLabel>
                <Input
                  id="voter-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={domains[0] ? `you${domains[0]}` : "you@example.com"}
                />
              </Field>
              <Button type="submit" disabled={!email || request.isPending}>
                {request.isPending && <Spinner />} Send code
              </Button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                verify.mutate();
              }}
            >
              <Field>
                <FieldLabel htmlFor="voter-code">6-digit code</FieldLabel>
                <Input
                  id="voter-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-lg tracking-[0.5em]"
                />
                <FieldDescription>
                  Sent to {email}. It expires in 15 minutes. On offline installs the code is written
                  to the server log.
                </FieldDescription>
              </Field>
              <Button type="submit" disabled={code.length !== 6 || verify.isPending}>
                {verify.isPending && <Spinner />} Verify and vote
              </Button>
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSent(false)}>
                  Use a different email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={request.isPending}
                  onClick={() => request.mutate()}
                >
                  Resend code
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-sm">
        Have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(`/e/${slug}/vote`)}`}
          className="text-foreground underline underline-offset-4"
        >
          Sign in instead
        </Link>
      </p>
    </div>
  );
}

function BallotSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="mb-2 h-8 w-48" />
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
