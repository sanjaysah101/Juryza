"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Progress } from "@juryza/ui/components/ui/progress";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@juryza/ui/components/ui/tabs";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface JudgeProgress {
  judgeId: string;
  name: string;
  assigned: number;
  scored: number;
}
interface Result {
  projectId: string;
  title: string;
  reviews: number;
  rawMean: number;
  normalizedMean: number;
  rank: number;
}
interface DashboardResponse {
  totals: { projects: number; judges: number; assignments: number; scores: number };
  progress: JudgeProgress[];
  results: Result[];
}

/**
 * Organizer dashboard (T2): live judging progress (who hasn't started),
 * normalized results, one-click assignment, and CSV export. Organizer/admin
 * only — the API enforces it; this page just renders what the backend allows.
 */
export default function OrganizerPage() {
  const { status, user } = auth.useSession();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn: () => api.get<DashboardResponse>("/api/organizer/dashboard"),
    enabled: status === "authenticated",
  });

  const assign = useMutation({
    mutationFn: () =>
      api.post("/api/organizer/assign", { strategy: "round-robin", reviewsPerProject: 3 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizer-dashboard"] });
      toast.success("Assignments generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (status === "authenticated" && user?.role !== "organizer" && user?.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-muted-foreground">This dashboard is for organizers only.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Organizer dashboard</h1>
          <p className="text-muted-foreground mt-1">Judging progress, results and exports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<a href="/organizer/new" />}>
            <Wand2 className="size-4" /> Create event
          </Button>
          <Button variant="outline" onClick={() => assign.mutate()} disabled={assign.isPending}>
            <Wand2 className="size-4" /> Auto-assign judges
          </Button>
          <Button nativeButton={false} render={<a href="/api/organizer/export.csv" />}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Projects" value={data.totals.projects} />
          <Stat label="Judges" value={data.totals.judges} />
          <Stat label="Assignments" value={data.totals.assignments} />
          <Stat label="Scores" value={data.totals.scores} />
        </div>
      )}

      <Tabs defaultValue="progress" className="mt-8">
        <TabsList>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judge</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Scored / assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.progress.map((p) => {
                  const pct = p.assigned > 0 ? Math.round((p.scored / p.assigned) * 100) : 0;
                  return (
                    <TableRow key={p.judgeId}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.scored === 0 && p.assigned > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            not started
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Progress value={pct} className="w-40" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.scored} / {p.assigned}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="results">
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="text-right">Raw</TableHead>
                  <TableHead className="text-right">Normalized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.results.map((r) => (
                  <TableRow key={r.projectId}>
                    <TableCell className="tabular-nums">{r.rank}</TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.reviews}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {r.rawMean.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {r.normalizedMean.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border/70 bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
