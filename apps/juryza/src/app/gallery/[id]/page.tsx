"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ArrowLeft, Code2, ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

interface ProjectDetail {
  id: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  description: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  videoUrl: string | null;
  techTags: string[] | null;
  status: string;
  trackId: string | null;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    fetch(`/api/projects/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Project not found");
        const json = (await res.json()) as { project: ProjectDetail };
        if (!cancelled) setProject(json.project);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Project not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="outline" nativeButton={false} render={<Link href="/gallery" />}>
          <ArrowLeft className="size-4" /> Back to gallery
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      ) : error || !project ? (
        <div className="border-border/70 bg-card rounded-2xl border p-8 text-center">
          <h1 className="text-2xl font-semibold">Project not found</h1>
          <p className="text-muted-foreground mt-2">
            This submission may have been removed or is private.
          </p>
          <div className="mt-6 flex justify-center">
            <Button nativeButton={false} render={<Link href="/gallery" />}>
              Return to the gallery
            </Button>
          </div>
        </div>
      ) : (
        <article className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm">
          <div className="border-b border-border/70 bg-muted/20 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="capitalize">{project.status}</Badge>
              {project.trackId && <Badge variant="secondary">Track</Badge>}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.title}
            </h1>
            {project.tagline && (
              <p className="text-muted-foreground mt-3 max-w-2xl text-lg">{project.tagline}</p>
            )}
          </div>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.7fr_0.9fr]">
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="size-4" /> Summary
                </h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {project.summary || project.description || "No summary provided."}
                </p>
              </section>

              {project.description && (
                <section>
                  <h2 className="mb-2 text-lg font-semibold">Project notes</h2>
                  <p className="text-muted-foreground whitespace-pre-line">{project.description}</p>
                </section>
              )}

              {project.techTags && project.techTags.length > 0 && (
                <section>
                  <h2 className="mb-2 text-lg font-semibold">Tech stack</h2>
                  <div className="flex flex-wrap gap-2">
                    {project.techTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-4">
              <div className="border-border/70 bg-muted/20 rounded-xl border p-4">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Links
                </h2>
                <div className="space-y-2">
                  {project.repoUrl ? (
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="border-border/70 bg-background hover:bg-muted flex w-full items-center justify-start gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <Code2 className="size-4" /> Repository
                    </a>
                  ) : null}
                  {project.liveUrl ? (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="border-border/70 bg-background hover:bg-muted flex w-full items-center justify-start gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="size-4" /> Live demo
                    </a>
                  ) : null}
                  {project.videoUrl ? (
                    <a
                      href={project.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="border-border/70 bg-background hover:bg-muted flex w-full items-center justify-start gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="size-4" /> Demo video
                    </a>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </article>
      )}
    </main>
  );
}
