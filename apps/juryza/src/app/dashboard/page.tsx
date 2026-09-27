"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface MyProject {
  id: string;
  title: string;
  status: string;
  trackId: string | null;
  tagline: string | null;
}

/**
 * Participant home: the projects on your teams (draft + submitted), with a link
 * into the editor. Server-gated too — the API only returns your teams' projects
 * — so this page merely reflects what the backend already scopes.
 */
export default function DashboardPage() {
  const { status } = auth.useSession();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => api.get<{ projects: MyProject[] }>("/api/projects"),
    enabled: status === "authenticated",
  });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/api/projects", { title: "Untitled project" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      router.push(`/projects/${res.id}/edit`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My projects</h1>
          <p className="text-muted-foreground mt-1">Draft, edit, and submit before the deadline.</p>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <FilePlus2 className="size-4" /> New project
        </Button>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : data && data.projects.length > 0 ? (
          data.projects.map((p) => (
            <div
              key={p.id}
              className="border-border/70 bg-card flex items-center justify-between gap-4 rounded-xl border p-5"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge variant={p.status === "submitted" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </div>
                {p.tagline && <span className="text-muted-foreground text-sm">{p.tagline}</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/projects/${p.id}/edit`} />}
              >
                <PencilLine className="size-4" /> Edit
              </Button>
            </div>
          ))
        ) : (
          <Empty className="mt-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FilePlus2 />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Create a project to start a draft. You can edit it until the deadline.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </main>
  );
}
