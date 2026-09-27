"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { api } from "@/lib/api";

interface BallotProject {
  id: string;
  title: string;
  tagline: string | null;
}
interface BallotResponse {
  event: { id: string; name: string } | null;
  votingOpen: boolean;
  resultsPublished: boolean;
  projects: BallotProject[];
}

/**
 * Community voting (T3). Ballots arrive in a per-voter randomized order (kills
 * position bias) and the page never shows tallies — results stay hidden until an
 * organizer publishes them. Quadratic credits (1/4/9 → 1/2/3 influence) let a
 * voter weight a favourite without a loud minority dominating.
 */
export default function VotePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ballot"],
    queryFn: () => api.get<BallotResponse>("/api/vote"),
  });

  const cast = useMutation({
    mutationFn: (v: { projectId: string; credits: number }) => api.post("/api/vote", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ballot"] });
      toast.success("Vote recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Community vote</h1>
      <p className="text-muted-foreground mt-1">
        Spend credits on the projects you like. Quadratic weighting: 1, 4 or 9 credits buy 1, 2 or 3
        units of influence — so piling on one project costs you.
      </p>

      {data && !data.votingOpen && (
        <Alert className="mt-6">
          <AlertTitle>Voting is closed</AlertTitle>
          <AlertDescription>The voting window for this event is not open.</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : (
          data?.projects.map((p) => (
            <div
              key={p.id}
              className="border-border/70 bg-card flex items-center justify-between gap-4 rounded-xl border p-5"
            >
              <div className="min-w-0">
                <h3 className="truncate font-medium">{p.title}</h3>
                {p.tagline && <p className="text-muted-foreground truncate text-sm">{p.tagline}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {[
                  { credits: 1, label: "+1" },
                  { credits: 4, label: "+2" },
                  { credits: 9, label: "+3" },
                ].map((opt) => (
                  <Button
                    key={opt.credits}
                    size="sm"
                    variant="outline"
                    disabled={!data?.votingOpen || cast.isPending}
                    onClick={() => cast.mutate({ projectId: p.id, credits: opt.credits })}
                  >
                    <ThumbsUp className="size-3.5" /> {opt.label}
                    <Badge variant="secondary" className="ml-1">
                      {opt.credits}c
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
