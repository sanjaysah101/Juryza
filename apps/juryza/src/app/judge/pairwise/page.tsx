"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface PairProject {
  id: string;
  title: string;
  tagline: string | null;
  summary: string | null;
}
interface PairResponse {
  pair: [PairProject, PairProject] | null;
  reason?: string;
}

/**
 * Pairwise judging (T2 bonus). Show two of the judge's assigned projects and ask
 * which is better — no absolute score. The Bradley–Terry estimator recovers a
 * global ranking from all the comparisons, sidestepping cross-judge calibration.
 */
export default function PairwisePage() {
  const { status, user } = auth.useSession();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["pairwise"],
    queryFn: () => api.get<PairResponse>("/api/judge/pairwise"),
    enabled: status === "authenticated",
  });

  const vote = useMutation({
    mutationFn: (v: { winnerId: string; loserId: string }) => api.post("/api/judge/pairwise", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pairwise"] });
      toast.success("Comparison recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (status === "authenticated" && user?.role !== "judge") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-muted-foreground">Pairwise judging is only available to judges.</p>
      </main>
    );
  }

  const pair = data?.pair;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Pairwise judging</h1>
      <p className="text-muted-foreground mt-1">
        Which project is better? Pick one — no scores. A Bradley–Terry model turns your comparisons
        into a global ranking.
      </p>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : pair ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pair.map((p, i) => {
            const other = pair[i === 0 ? 1 : 0];
            return (
              <div
                key={p.id}
                className="border-border/70 bg-card flex flex-col gap-3 rounded-xl border p-6"
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-muted-foreground flex-1 text-sm">
                  {p.tagline || p.summary || "No description."}
                </p>
                <Button
                  onClick={() => vote.mutate({ winnerId: p.id, loserId: other.id })}
                  disabled={vote.isPending}
                >
                  This one is better
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty className="mt-16">
          <EmptyHeader>
            <EmptyTitle>Nothing to compare</EmptyTitle>
            <EmptyDescription>
              {data?.reason ?? "You need at least two assigned projects to compare."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </main>
  );
}
