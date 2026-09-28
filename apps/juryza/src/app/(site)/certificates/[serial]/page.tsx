"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Copy,
  FileSearch,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { cn } from "@juryza/ui/lib/utils";

import { LogoMark } from "@/components/brand";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * A printable certificate with its public verification panel. Printing (or
 * "Save as PDF") outputs just the certificate.
 */

interface CertificateView {
  serial: string;
  kind: string;
  subjectName: string;
  subjectUsername: string | null;
  statement: string;
  reviewsCompleted: number;
  event: { name: string; slug: string };
  issuedAt: string;
  signature: string;
  algorithm: string;
  valid: boolean;
}

const KIND: Record<string, { title: string; lead: string }> = {
  winner: { title: "Certificate of Achievement", lead: "is recognised for outstanding work at" },
  judge: { title: "Certificate of Judging", lead: "served on the judging panel of" },
  participant: { title: "Certificate of Participation", lead: "took part in" },
};

/** Print only the certificate: hide the site chrome around it. */
const PRINT_CSS = `@media print {
  @page { size: landscape; margin: 12mm; }
  body > * header, body > * footer { display: none !important; }
}`;

export default function CertificatePage() {
  const { serial } = useParams<{ serial: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["certificate", serial],
    queryFn: () => api.get<CertificateView>(`/api/certificates/${encodeURIComponent(serial)}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="aspect-[1.414] rounded-2xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Empty className="my-24">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearch />
          </EmptyMedia>
          <EmptyTitle>No certificate found</EmptyTitle>
          <EmptyDescription>
            There's no certificate with serial{" "}
            <span className="font-mono">{decodeURIComponent(serial).toUpperCase()}</span>. Check for
            typos — serials look like JZ-XXXXX-XXXXX.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/certificates" />}>
            Try another serial
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const kind = KIND[data.kind] ?? { title: "Certificate", lead: "is recognised by" };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/certificates" />}
        >
          <ArrowLeft /> Verify another
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Print / Save PDF
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
        <Certificate data={data} kind={kind} />
        <VerificationPanel data={data} />
      </div>
    </div>
  );
}

function Certificate({
  data,
  kind,
}: {
  data: CertificateView;
  kind: { title: string; lead: string };
}) {
  return (
    <article
      className="bg-card text-card-foreground relative overflow-hidden rounded-2xl p-3 shadow-xl ring-1 ring-foreground/10 print:rounded-none print:bg-white print:text-black print:shadow-none print:ring-0"
      aria-label={kind.title}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      />
      <div className="border-primary/40 relative flex flex-col items-center gap-6 rounded-xl border-2 px-6 py-10 text-center sm:px-14 sm:py-14 print:border-black/40">
        <div
          className="border-primary/20 pointer-events-none absolute inset-2 rounded-lg border print:border-black/20"
          aria-hidden
        />
        <div className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Juryza</span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-primary text-xs font-semibold tracking-[0.3em] uppercase print:text-black/70">
            {kind.title}
          </p>
          <p className="text-muted-foreground font-serif text-base italic print:text-black/60">
            This certifies that
          </p>
        </div>
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {data.subjectName}
        </h1>
        <div className="bg-primary/40 h-px w-40 print:bg-black/30" aria-hidden />
        <p className="text-muted-foreground max-w-xl text-pretty print:text-black/70">
          {kind.lead}{" "}
          <span className="text-foreground font-semibold print:text-black">{data.event.name}</span>
        </p>
        <p className="max-w-xl font-serif text-lg leading-relaxed text-pretty">{data.statement}</p>
        {data.kind === "judge" && data.reviewsCompleted > 0 && (
          <p className="text-muted-foreground text-sm print:text-black/60">
            {data.reviewsCompleted} project reviews completed
          </p>
        )}

        <div className="mt-4 grid w-full grid-cols-1 items-end gap-6 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p className="text-sm font-medium">
              {formatDate(data.issuedAt, { dateStyle: "long" })}
            </p>
            <div className="bg-border h-px w-32 print:bg-black/30" />
            <p className="text-muted-foreground text-xs print:text-black/60">Date issued</p>
          </div>
          <div className="flex justify-center">
            <div className="border-primary/50 bg-primary/5 text-primary relative grid size-24 place-items-center rounded-full border-2 border-dashed print:border-black/40 print:bg-transparent print:text-black">
              <div className="flex flex-col items-center">
                <BadgeCheck className="size-8" />
                <span className="text-[0.6rem] font-semibold tracking-widest uppercase">
                  Signed
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <p className="font-mono text-sm font-medium">{data.serial}</p>
            <div className="bg-border h-px w-32 print:bg-black/30" />
            <p className="text-muted-foreground text-xs print:text-black/60">Serial number</p>
          </div>
        </div>
        <p className="text-muted-foreground max-w-full truncate font-mono text-[0.65rem] print:text-black/50">
          Verify at /certificates/{data.serial} · {data.algorithm} {data.signature.slice(0, 24)}…
        </p>
      </div>
    </article>
  );
}

function VerificationPanel({ data }: { data: CertificateView }) {
  const [copied, setCopied] = useState(false);
  async function copySignature() {
    try {
      await navigator.clipboard.writeText(data.signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the signature");
    }
  }
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Verification
          {data.valid ? (
            <Badge className="bg-success text-success-foreground">
              <ShieldCheck /> Valid
            </Badge>
          ) : (
            <Badge variant="destructive">
              <ShieldAlert /> Invalid
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.valid ? (
          <Alert className="border-success/30 bg-success/10">
            <ShieldCheck className="text-success" />
            <AlertTitle>Authentic and unaltered</AlertTitle>
            <AlertDescription>
              The signature matches the record issued by this Juryza instance.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Signature mismatch</AlertTitle>
            <AlertDescription>
              This record was changed after it was issued. Don't rely on it.
            </AlertDescription>
          </Alert>
        )}
        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Recipient">
            {data.subjectUsername ? (
              <Link href={`/u/${data.subjectUsername}`} className="hover:underline">
                {data.subjectName}
              </Link>
            ) : (
              data.subjectName
            )}
          </Row>
          <Row label="Event">
            <Link href={`/e/${data.event.slug}`} className="hover:underline">
              {data.event.name}
            </Link>
          </Row>
          <Row label="Type">
            <span className="capitalize">{data.kind}</span>
          </Row>
          <Row label="Issued">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="text-muted-foreground size-3.5" />{" "}
              {formatDateTime(data.issuedAt)}
            </span>
          </Row>
          <Row label="Algorithm">
            <span className="font-mono">{data.algorithm}</span>
          </Row>
        </dl>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Signature</p>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={copySignature}
              aria-label="Copy signature"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <code
            className={cn(
              "bg-muted block rounded-md p-2.5 font-mono text-[0.7rem] leading-relaxed break-all",
              !data.valid && "text-destructive"
            )}
          >
            {data.signature}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}
