"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  Compass,
  FolderKanban,
  PencilLine,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
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
import { cn } from "@juryza/ui/lib/utils";

import { coverStyle, EventCover } from "@/components/event-bits";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";
import { formatDateTime, hueOf, pluralize, relativeTime } from "@/lib/format";
import { submissionsAreOpen } from "@/lib/phase";
import type { overviewFor } from "@/lib/server/people";
import type { Json } from "@/lib/types";

/**
 * My projects: every project the viewer works on, across events, with its
 * status and the time left to edit — plus a one-click "start a project" for
 * each event where they have a team but nothing started yet.
 */

type Overview = Json<Awaited<ReturnType<typeof overviewFor>>>;

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["me", "overview"],
    queryFn: () => api.get<Overview>("/api/me/overview"),
  });

  const start = useMutation({
    mutationFn: (slug: string) =>
      api.post<{ id: string }>(`/api/events/${slug}/projects`, { title: "Untitled project" }),
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ["me", "overview"] });
      router.push(`/projects/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const withProject = new Set(data?.projects.map((p) => p.eventSlug));
  const startable = (data?.participating ?? []).filter(
    (e) => e.teamId && !withProject.has(e.slug) && submissionsAreOpen(e)
  );
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="My projects"
        description="Everything you're building, across every event. Drafts stay private to your team until you submit."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
            <Compass /> Find an event
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn't load your projects</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {startable.length > 0 && (
            <Section
              title="Ready to start"
              description="Your team is set — start the project and fill it in together."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {startable.map((e) => (
                  <Card key={e.id} className="flex-row items-center gap-4 border-dashed px-4 py-4">
                    <EventCover hue={e.hue} className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        Team {e.teamName} · closes {relativeTime(e.submissionsClose, now)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => start.mutate(e.slug)}
                      disabled={start.isPending}
                    >
                      {start.isPending && start.variables === e.slug ? <Spinner /> : <Plus />} Start
                      a project
                    </Button>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {data?.projects.length ? (
            <Section title="Your projects" description={pluralize(data.projects.length, "project")}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.projects.map((p) => {
                  const closes = new Date(p.submissionsClose).getTime();
                  const open = closes > now;
                  const soon = open && closes - now < 48 * 3600_000;
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="group focus-visible:outline-none"
                    >
                      <Card className="group-focus-visible:ring-ring/50 h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md group-focus-visible:ring-3">
                        <div
                          className="relative h-24"
                          style={p.thumbnailUrl ? undefined : coverStyle(hueOf(p.id))}
                        >
                          {p.thumbnailUrl && (
                            // biome-ignore lint/performance/noImgElement: arbitrary user-supplied URL
                            <img
                              src={p.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 size-full object-cover"
                            />
                          )}
                          <Badge
                            variant={p.status === "submitted" ? "default" : "secondary"}
                            className="absolute top-3 left-3 capitalize shadow-sm"
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <CardContent className="flex flex-1 flex-col gap-3 p-4">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{p.title}</h3>
                            <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm">
                              {p.tagline || "No tagline yet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="max-w-full truncate">
                              {p.eventName}
                            </Badge>
                            {p.trackName && <Badge variant="outline">{p.trackName}</Badge>}
                          </div>
                          <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs">
                            <span className="flex items-center gap-1.5 truncate">
                              <UsersRound className="size-3.5 shrink-0" />
                              {p.teamName} · edited {relativeTime(p.updatedAt, now)}
                            </span>
                            {open ? (
                              <span
                                title={formatDateTime(closes)}
                                className={cn(
                                  "flex shrink-0 items-center gap-1",
                                  soon && "text-destructive font-medium"
                                )}
                              >
                                <CalendarClock className="size-3.5" />
                                {relativeTime(closes, now)}
                              </span>
                            ) : (
                              <span className="shrink-0">Closed</span>
                            )}
                          </div>
                          {p.status === "draft" && open && (
                            <p className="bg-muted text-muted-foreground -mx-1 rounded-md px-2 py-1.5 text-xs">
                              Draft — submit before {formatDateTime(closes)} so judges can see it.
                            </p>
                          )}
                          <span className="text-primary flex items-center gap-1 text-sm font-medium">
                            <PencilLine className="size-3.5" />{" "}
                            {open ? "Open editor" : "View project"}
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </Section>
          ) : (
            startable.length === 0 && (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderKanban />
                  </EmptyMedia>
                  <EmptyTitle>No projects yet</EmptyTitle>
                  <EmptyDescription>
                    Join an event and form a team — then start your project here and write it up
                    like a doc.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button nativeButton={false} render={<Link href="/events" />}>
                    <Compass /> Explore events
                  </Button>
                </EmptyContent>
              </Empty>
            )
          )}
        </>
      )}
    </>
  );
}
