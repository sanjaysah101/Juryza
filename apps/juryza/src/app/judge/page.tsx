"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Code, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Progress } from "@juryza/ui/components/ui/progress";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Textarea } from "@juryza/ui/components/ui/textarea";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface Criterion {
  key: string;
  label: string;
  weight: number;
}

interface AssignmentItem {
  projectId: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  videoUrl: string | null;
  trackName: string | null;
  scored: boolean;
  criteria: Record<string, number> | null;
  comment: string | null;
}

interface AssignmentsResponse {
  judgeId: string;
  total: number;
  scored: number;
  assignments: AssignmentItem[];
}

/**
 * Judge console (T2). Shows ONLY this judge's assigned projects (the API scopes
 * to the caller — a judge can neither see nor score another judge's queue), a
 * progress bar, and a weighted-rubric scoring form per project.
 */
export default function JudgeConsolePage() {
  const { status, user } = auth.useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => api.get<AssignmentsResponse>("/api/judge/assignments"),
    enabled: status === "authenticated",
  });
  const { data: rubric } = useQuery({
    queryKey: ["rubric"],
    queryFn: () => api.get<{ criteria: Criterion[] }>("/api/rubric"),
  });

  if (status === "authenticated" && user?.role !== "judge") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-muted-foreground">The judge console is only available to judges.</p>
      </main>
    );
  }

  const pct = data && data.total > 0 ? Math.round((data.scored / data.total) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Judge console</h1>
      <p className="text-muted-foreground mt-1">Score the projects assigned to you.</p>

      {data && (
        <div className="mt-6 flex items-center gap-4">
          <Progress value={pct} className="flex-1" />
          <span className="text-muted-foreground text-sm tabular-nums">
            {data.scored} / {data.total} scored
          </span>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </>
        ) : (
          data?.assignments.map((a) => (
            <ScoreCard key={a.projectId} item={a} rubric={rubric?.criteria ?? []} />
          ))
        )}
      </div>
    </main>
  );
}

function ScoreCard({ item, rubric }: { item: AssignmentItem; rubric: Criterion[] }) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState<Record<string, number>>(item.criteria ?? {});
  const [comment, setComment] = useState(item.comment ?? "");

  const submit = useMutation({
    mutationFn: () =>
      api.post("/api/judge/scores", { projectId: item.projectId, criteria: marks, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success(`Saved score for ${item.title}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-border/70 bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{item.title}</h3>
            {item.trackName && <Badge variant="secondary">{item.trackName}</Badge>}
          </div>
          {item.tagline && <p className="text-muted-foreground mt-1 text-sm">{item.tagline}</p>}
        </div>
        {item.scored ? (
          <CheckCircle2 className="text-primary size-5 shrink-0" />
        ) : (
          <Circle className="text-muted-foreground size-5 shrink-0" />
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
        {item.repoUrl && (
          <a
            href={item.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1"
          >
            <Code className="size-3.5" /> Repo
          </a>
        )}
        {item.liveUrl && (
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1"
          >
            <ExternalLink className="size-3.5" /> Live
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rubric.map((c) => (
          <div key={c.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.label}</span>
              <span className="text-muted-foreground text-xs">×{c.weight}</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMarks((m) => ({ ...m, [c.key]: n }))}
                  className={`size-8 rounded-md border text-sm font-medium transition-colors ${
                    marks[c.key] === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Textarea
        placeholder="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />

      <div className="flex justify-end">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending} size="sm">
          {item.scored ? "Update score" : "Save score"}
        </Button>
      </div>
    </div>
  );
}
