"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Trophy } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";

import { api } from "@/lib/api";

interface Result {
  projectId: string;
  title: string;
  rank: number;
  reviews: number;
  normalizedMean: number;
  voteInfluence: number;
  voters: number;
}
interface ResultsResponse {
  published: boolean;
  previewForOrganizer?: boolean;
  results: Result[];
}

/**
 * Public results (T3). Hidden until an organizer publishes: a non-organizer sees
 * a "not published" state and no numbers. Shows the normalized judge ranking and
 * the quadratic community-vote influence side by side.
 */
export default function ResultsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: () => api.get<ResultsResponse>("/api/results"),
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Results</h1>

      {data?.previewForOrganizer && (
        <Alert className="mt-4">
          <AlertTitle>Organizer preview</AlertTitle>
          <AlertDescription>
            Results are not published yet — only organizers can see this. Publish from the dashboard
            to make them public.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="mt-8 h-64 rounded-xl" />
      ) : data && !data.published && !data.previewForOrganizer ? (
        <Alert className="mt-8">
          <Lock className="size-4" />
          <AlertTitle>Results are not published yet</AlertTitle>
          <AlertDescription>
            The organizer will publish results once judging and voting close.
          </AlertDescription>
        </Alert>
      ) : (
        <Table className="mt-8">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Reviews</TableHead>
              <TableHead className="text-right">Normalized</TableHead>
              <TableHead className="text-right">Vote influence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.results.map((r) => (
              <TableRow key={r.projectId}>
                <TableCell>
                  {r.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Trophy className="size-4 text-amber-500" /> 1
                    </span>
                  ) : (
                    <span className="tabular-nums">{r.rank}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-right tabular-nums">{r.reviews}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {r.normalizedMean.toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.voteInfluence.toFixed(1)}
                  {r.voters > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {r.voters}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
