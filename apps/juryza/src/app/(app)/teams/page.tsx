"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, FolderKanban, UserPlus, UsersRound } from "lucide-react";

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

import { EventCover, NextMilestone, PhaseBadge } from "@/components/event-bits";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";
import type { overviewFor } from "@/lib/server/people";
import type { Json } from "@/lib/types";

/**
 * My teams: one card per event where the viewer is on a team (linking to the
 * team page), plus the events they joined but haven't found a team for yet.
 */

type Overview = Json<Awaited<ReturnType<typeof overviewFor>>>;

export default function TeamsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["me", "overview"],
    queryFn: () => api.get<Overview>("/api/me/overview"),
  });
  const teams = data?.participating.filter((e) => e.teamId) ?? [];
  const teamless = data?.participating.filter((e) => !e.teamId) ?? [];
  const projectByEvent = new Map(data?.projects.map((p) => [p.eventSlug, p]));

  return (
    <>
      <PageHeader
        title="My teams"
        description="The people you're building with, one team per event."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
            <Compass /> Explore events
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn't load your teams</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : teams.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>You're not on a team yet</EmptyTitle>
            <EmptyDescription>
              Create a team from an event page, or ask a teammate for their invite link.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/events" />}>
              <Compass /> Find an event
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((e) => {
            const project = projectByEvent.get(e.slug);
            return (
              <Link
                key={e.id}
                href={`/teams/${e.teamId}`}
                className="group focus-visible:outline-none"
              >
                <Card className="group-focus-visible:ring-ring/50 h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md group-focus-visible:ring-3">
                  <EventCover hue={e.hue} className="h-16" />
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">{e.teamName}</h3>
                        <p className="text-muted-foreground truncate text-sm">{e.name}</p>
                      </div>
                      <PhaseBadge event={e} className="shrink-0" />
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <FolderKanban className="size-3.5" />
                      {project ? (
                        <>
                          <span className="text-foreground truncate">{project.title}</span>
                          <Badge
                            variant={project.status === "submitted" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {project.status}
                          </Badge>
                        </>
                      ) : (
                        "No project yet"
                      )}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                      <NextMilestone event={e} className="text-xs" />
                      <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {teamless.length > 0 && (
        <Section
          title="Still looking for a team"
          description="You're registered for these events but not on a team yet."
        >
          <Card className="py-0">
            <ul className="divide-y">
              {teamless.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                  <EventCover hue={e.hue} className="size-10 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.name}</p>
                    <NextMilestone event={e} className="text-xs" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/e/${e.slug}/teams`} />}
                  >
                    <UserPlus /> Find a team
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </>
  );
}
