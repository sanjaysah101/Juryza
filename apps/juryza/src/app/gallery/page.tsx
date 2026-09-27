"use client";

import { useState } from "react";
import Link from "next/link";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Code, ExternalLink, Search } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Input } from "@juryza/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@juryza/ui/components/ui/select";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { api } from "@/lib/api";

interface GalleryProject {
  id: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  trackId: string | null;
  trackName: string | null;
}

interface GalleryResponse {
  event: { id: string; name: string } | null;
  count: number;
  projects: GalleryProject[];
}

/**
 * Public gallery (T1). Search + track filter, both server-side via the same
 * `/api/gallery` route the acceptance checker hits. No auth required.
 */
export default function GalleryPage() {
  const [q, setQ] = useState("");
  const [track, setTrack] = useState<string>("all");

  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (track !== "all") params.set("track", track);
  const query = params.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["gallery", q, track],
    queryFn: () => api.get<GalleryResponse>(`/api/gallery${query ? `?${query}` : ""}`),
    placeholderData: keepPreviousData,
  });

  const { data: tracks } = useQuery({
    queryKey: ["gallery-tracks"],
    queryFn: () => api.get<{ tracks: { id: string; name: string }[] }>("/api/tracks"),
  });

  const selectedTrackLabel =
    track === "all" ? "All tracks" : (tracks?.tracks.find((t) => t.id === track)?.name ?? track);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Project gallery</h1>
        <p className="text-muted-foreground">
          {data?.event ? data.event.name : "Browse submitted projects"}
          {typeof data?.count === "number" && ` · ${data.count} projects`}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            className="pl-9"
          />
        </div>
        <Select value={track} onValueChange={(v) => setTrack(v ?? "all")}>
          <SelectTrigger className="sm:w-56">
            <span className="flex-1 text-left">{selectedTrackLabel}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tracks</SelectItem>
            {tracks?.tracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : data && data.projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty className="mt-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No projects found</EmptyTitle>
              <EmptyDescription>
                Try a different search term or clear the track filter.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </main>
  );
}

function ProjectCard({ project }: { project: GalleryProject }) {
  return (
    <Link
      href={`/gallery/${project.id}`}
      className="group border-border/70 bg-card hover:border-border hover:shadow-sm flex flex-col gap-3 rounded-xl border p-5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight group-hover:underline">{project.title}</h3>
        {project.trackName && (
          <Badge variant="secondary" className="shrink-0">
            {project.trackName}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground line-clamp-3 text-sm">
        {project.tagline || project.summary || "No description yet."}
      </p>
      <div className="text-muted-foreground mt-auto flex items-center gap-3 text-xs">
        {project.repoUrl && (
          <span className="inline-flex items-center gap-1">
            <Code className="size-3.5" /> Repo
          </span>
        )}
        {project.liveUrl && (
          <span className="inline-flex items-center gap-1">
            <ExternalLink className="size-3.5" /> Live
          </span>
        )}
      </div>
    </Link>
  );
}
