"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Crown,
  Link2Off,
  LogIn,
  UserPlus,
  UsersRound,
} from "lucide-react";
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
import { UserAvatar } from "@/components/user-avatar";
import { useViewer } from "@/components/viewer";
import { api } from "@/lib/api";

/** Accept a team invite link: preview the team, then join it in one click. */

interface Preview {
  team: { id: string; name: string; description: string | null };
  event: { id: string; slug: string; name: string; maxTeamSize: number; hue: number };
  members: { name: string; username: string | null; image: string | null; role: string }[];
  open: boolean;
  full: boolean;
}

export default function JoinTeamPage() {
  const { token } = useParams<{ token: string }>();
  const viewer = useViewer();
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ["team-invite", token],
    queryFn: () => api.get<Preview>(`/api/teams/join?token=${encodeURIComponent(token)}`),
    retry: false,
  });

  const join = useMutation({
    mutationFn: () =>
      api.post<{ teamId: string; alreadyMember: boolean }>("/api/teams/join", { token }),
    onSuccess: (r) => {
      toast.success(
        r.alreadyMember
          ? "You're already on this team"
          : `Welcome to ${data?.team.name ?? "the team"}!`
      );
      router.push(`/teams/${r.teamId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const next = encodeURIComponent(`/join/${token}`);
  const isMember = Boolean(
    viewer?.username && data?.members.some((m) => m.username === viewer.username)
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : error || !data ? (
        <Empty className="border py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2Off />
            </EmptyMedia>
            <EmptyTitle>Invite link not valid</EmptyTitle>
            <EmptyDescription>
              {error?.message ?? "This invite link is invalid or has been reset."} Ask the team for
              a fresh link.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
              Browse events
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="gap-0 py-0 shadow-lg">
          <EventCover hue={data.event.hue} className="flex h-28 items-end p-5 text-white">
            <div className="relative">
              <p className="text-xs font-medium tracking-wider text-white/75 uppercase">
                You're invited to join a team
              </p>
              <Link href={`/e/${data.event.slug}`} className="text-sm font-medium hover:underline">
                {data.event.name}
              </Link>
            </div>
          </EventCover>
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{data.team.name}</h1>
              {data.team.description && (
                <p className="text-muted-foreground text-sm">{data.team.description}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground flex items-center justify-between text-xs font-medium tracking-wider uppercase">
                <span>Members</span>
                <span className="tabular-nums">
                  {data.members.length}/{data.event.maxTeamSize}
                </span>
              </p>
              <ul className="flex flex-col divide-y rounded-lg border">
                {data.members.map((m) => (
                  <li
                    key={`${m.username ?? m.name}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <UserAvatar name={m.name} image={m.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      {m.username && (
                        <p className="text-muted-foreground truncate text-xs">@{m.username}</p>
                      )}
                    </div>
                    {m.role === "owner" && (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Crown className="size-3.5" /> Owner
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isMember ? null : !data.open ? (
              <Alert>
                <AlertCircle />
                <AlertTitle>Team formation is closed</AlertTitle>
                <AlertDescription>
                  The submission deadline for this event has passed.
                </AlertDescription>
              </Alert>
            ) : data.full ? (
              <Alert>
                <UsersRound />
                <AlertTitle>This team is full</AlertTitle>
                <AlertDescription>
                  Teams are capped at {data.event.maxTeamSize}. Browse other teams that are looking
                  for members.
                </AlertDescription>
              </Alert>
            ) : null}

            {!viewer ? (
              <div className="flex flex-col gap-2">
                <Button nativeButton={false} render={<Link href={`/signup?next=${next}`} />}>
                  <UserPlus /> Create an account to join
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/login?next=${next}`} />}
                >
                  <LogIn /> Sign in
                </Button>
              </div>
            ) : isMember ? (
              <Button
                size="lg"
                className="h-10"
                onClick={() => join.mutate()}
                disabled={join.isPending}
              >
                {join.isPending ? <Spinner /> : <ArrowRight />} You're on this team — open it
              </Button>
            ) : data.open && !data.full ? (
              <Button
                size="lg"
                className="h-10"
                onClick={() => join.mutate()}
                disabled={join.isPending}
              >
                {join.isPending ? <Spinner /> : <UserPlus />} Join {data.team.name}
              </Button>
            ) : (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/e/${data.event.slug}/teams`} />}
              >
                See other teams <ArrowRight />
              </Button>
            )}
            {viewer && (
              <p className="text-muted-foreground text-center text-xs">
                Joining as {viewer.name} · you can only be on one team per event.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
