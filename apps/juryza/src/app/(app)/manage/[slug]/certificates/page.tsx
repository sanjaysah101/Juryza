"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, ExternalLink, Fingerprint, Gavel, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@juryza/ui/components/ui/tooltip";

import { PageHeader, Section, StatCard } from "@/components/page";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { useEvent } from "@/lib/queries";
import type { Certificate, Json } from "@/lib/types";

/**
 * Certificates: issue signed judge-participation and prize-winner records in
 * bulk. Each one carries an HMAC-SHA256 signature over its fields, so anyone
 * can verify it at /certificates/<serial> without an account.
 */

type Kind = "judges" | "winners";

export default function CertificatesPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const { data: detail } = useEvent(slug);
  const published = detail?.event.resultsPublished ?? false;
  const { data, isLoading, error } = useQuery({
    queryKey: ["certificates", slug],
    queryFn: () =>
      api.get<{ certificates: Json<Certificate>[] }>(`/api/events/${slug}/certificates`),
  });

  const issue = useMutation({
    mutationFn: (kind: Kind) =>
      api.post<{ issued: number; serials: string[] }>(`/api/events/${slug}/certificates`, { kind }),
    onSuccess: (res, kind) => {
      toast.success(
        res.issued
          ? `Issued ${pluralize(res.issued, "certificate")}`
          : `Everyone eligible already has a ${kind === "judges" ? "judge" : "winner"} certificate`
      );
      qc.invalidateQueries({ queryKey: ["certificates", slug] });
    },
    onError: (e) => toast.error(e.message),
  });

  const certs = data?.certificates ?? [];
  const judges = certs.filter((c) => c.kind === "judge").length;
  const winners = certs.filter((c) => c.kind === "winner").length;

  const winnersButton = (
    <Button disabled={!published || issue.isPending} onClick={() => issue.mutate("winners")}>
      {issue.isPending && issue.variables === "winners" ? <Spinner /> : <Trophy />} Issue winner
      certificates
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Certificates"
        description="Tamper-evident records for your judges and winners, verifiable by anyone with the serial."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="size-4" /> Judge certificates
            </CardTitle>
            <CardDescription>
              One per judge who completed at least one review, stating how many projects they
              reviewed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              disabled={issue.isPending}
              onClick={() => issue.mutate("judges")}
            >
              {issue.isPending && issue.variables === "judges" ? <Spinner /> : <Award />} Issue
              judge certificates
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Winner certificates
            </CardTitle>
            <CardDescription>
              One per team member, per prize won, naming the project. Available once results are
              published.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            {published ? (
              winnersButton
            ) : (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  {winnersButton}
                </TooltipTrigger>
                <TooltipContent>
                  Publish results first — winners aren't final until then.
                </TooltipContent>
              </Tooltip>
            )}
          </CardFooter>
        </Card>
      </div>

      <Alert>
        <Fingerprint />
        <AlertTitle>How verification works</AlertTitle>
        <AlertDescription>
          At issue time the server signs the serial, name, kind, statement, review count and
          timestamp with HMAC-SHA256 using a key only this instance holds. The public page at{" "}
          <code className="font-mono">/certificates/&lt;serial&gt;</code> recomputes the signature —
          if any field was edited in the database afterwards, it shows as invalid. Re-issuing is
          safe: people who already hold a certificate are skipped.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Issued" value={isLoading ? "…" : certs.length} icon={BadgeCheck} />
        <StatCard label="Judges" value={isLoading ? "…" : judges} />
        <StatCard label="Winners" value={isLoading ? "…" : winners} />
      </div>

      <Section title="Issued certificates">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load certificates</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : certs.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Award />
              </EmptyMedia>
              <EmptyTitle>Nothing issued yet</EmptyTitle>
              <EmptyDescription>
                Issue judge certificates when judging wraps up, winner certificates after
                publishing.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Serial</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Statement</TableHead>
                    <TableHead className="pr-4">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-4">
                        <Link
                          href={`/certificates/${c.serial}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                        >
                          {c.serial} <ExternalLink className="size-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{c.subjectName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.kind === "winner" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {c.kind === "winner" ? <Trophy /> : <Gavel />} {c.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-md min-w-64 text-sm whitespace-normal">
                        {c.subjectName} {c.statement}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground pr-4 text-sm"
                        title={formatDateTime(c.issuedAt)}
                      >
                        {formatDate(c.issuedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
