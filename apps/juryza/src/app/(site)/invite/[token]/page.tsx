"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Gavel, Link2Off, LogIn, MailWarning, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";

import { EventCover } from "@/components/event-bits";
import { useViewer } from "@/components/viewer";
import { api } from "@/lib/api";

/** Accept a judging invitation. The invite is bound to one email address. */

interface InvitePreview {
  email: string;
  accepted: boolean;
  event: { slug: string; name: string; tagline: string | null; hue: number };
}

export default function JudgeInvitePage() {
  const { token } = useParams<{ token: string }>();
  const viewer = useViewer();
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["judge-invite", token],
    queryFn: () => api.get<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<{ eventSlug: string }>(`/api/invites/${encodeURIComponent(token)}`),
    onSuccess: (r) => {
      toast.success("You're on the judging panel");
      router.push(`/judging/${r.eventSlug}`);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const next = encodeURIComponent(`/invite/${token}`);
  const wrongEmail = Boolean(
    viewer && data && viewer.email.toLowerCase() !== data.email.toLowerCase()
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      {isLoading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : error || !data ? (
        <Empty className="border py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2Off />
            </EmptyMedia>
            <EmptyTitle>Invitation not found</EmptyTitle>
            <EmptyDescription>
              {error?.message ?? "This invitation is invalid or was revoked."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              Go home
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="gap-0 py-0 shadow-lg">
          <EventCover hue={data.event.hue} className="flex h-32 items-center justify-center">
            <span className="relative grid size-14 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30 backdrop-blur">
              <Gavel className="size-7" />
            </span>
          </EventCover>
          <CardContent className="flex flex-col gap-5 p-6 text-center">
            <div className="flex flex-col gap-2">
              <p className="text-primary text-sm font-medium">Judging invitation</p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                Join the panel for{" "}
                <Link href={`/e/${data.event.slug}`} className="hover:underline">
                  {data.event.name}
                </Link>
              </h1>
              {data.event.tagline && (
                <p className="text-muted-foreground text-sm">{data.event.tagline}</p>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              This invitation is for{" "}
              <span className="text-foreground font-medium">{data.email}</span>.
            </p>

            <ul className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-4 text-left text-sm">
              <li className="flex gap-2">
                <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                You score only the projects assigned to you, blind to other judges' scores.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                Your scores are normalized, so being a tough (or generous) marker is fine.
              </li>
            </ul>

            {wrongEmail && (
              <Alert variant="destructive" className="text-left">
                <MailWarning />
                <AlertTitle>Signed in as a different account</AlertTitle>
                <AlertDescription>
                  You're signed in as {viewer?.email}. Sign in with {data.email} to accept this
                  invitation.
                </AlertDescription>
              </Alert>
            )}

            {!viewer ? (
              <div className="flex flex-col gap-2">
                <Button nativeButton={false} render={<Link href={`/login?next=${next}`} />}>
                  <LogIn /> Sign in to accept
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/signup?next=${next}`} />}
                >
                  <UserPlus /> Create an account with {data.email}
                </Button>
              </div>
            ) : wrongEmail ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/login?next=${next}`} />}
              >
                <LogIn /> Use another account
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-10"
                onClick={() => accept.mutate()}
                disabled={accept.isPending}
              >
                {accept.isPending ? <Spinner /> : <Gavel />}{" "}
                {data.accepted ? "Continue to judging" : "Accept invitation"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
