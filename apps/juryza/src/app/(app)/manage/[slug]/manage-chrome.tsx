"use client";

import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { EventCover, NextMilestone, PhaseBadge } from "@/components/event-bits";
import { useEvent } from "@/lib/queries";

/**
 * Header shared by every /manage/<slug> page. Pages read the same event via
 * `useEvent(slug)` (cached) and render their own section below.
 */
export function ManageChrome({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { data, isLoading, error } = useEvent(slug);

  if (error || (data && !data.viewer?.canManage)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>You can't manage this event</EmptyTitle>
          <EmptyDescription>
            Only the event's organizers (and platform admins) can open its console.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <EventCover hue={data?.event.hue ?? 250} className="size-12 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {isLoading || !data ? (
            <Skeleton className="h-7 w-64" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{data.event.name}</h1>
                {data.event.visibility === "draft" && (
                  <Badge variant="outline">Draft — only you can see it</Badge>
                )}
                <PhaseBadge event={data.event} />
              </div>
              <NextMilestone event={data.event} className="text-xs" />
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/e/${slug}`} target="_blank" />}
        >
          <ExternalLink /> Public page
        </Button>
      </div>
      {children}
    </div>
  );
}
