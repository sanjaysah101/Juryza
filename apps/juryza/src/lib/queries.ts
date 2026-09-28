"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Announcement, Event, Json, Prize, RubricCriterion, Track } from "@/lib/types";

/**
 * Shared queries and their cache keys. Pages under /e/<slug> and
 * /manage/<slug> read the event through `useEvent`, so a mutation anywhere can
 * refresh them all with `queryClient.invalidateQueries({ queryKey: eventKey(slug) })`.
 */

export interface EventDetail {
  event: Json<Event>;
  tracks: Json<Track>[];
  prizes: Json<Prize>[];
  criteria: Json<RubricCriterion>[];
  judges: {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    headline: string | null;
  }[];
  announcements: Json<Announcement>[];
  counts: { projects: number; participants: number; teams: number };
  viewer: null | {
    registered: boolean;
    team: { id: string; name: string; role: string } | null;
    isJudge: boolean;
    canManage: boolean;
  };
}

export const eventKey = (slug: string) => ["event", slug] as const;

export function useEvent(slug: string) {
  return useQuery({
    queryKey: eventKey(slug),
    queryFn: () => api.get<EventDetail>(`/api/events/${slug}`),
  });
}
