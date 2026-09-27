"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Input } from "@juryza/ui/components/ui/input";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface TeamRow {
  id: string;
  name: string;
  eventId: string;
  inviteToken: string;
}

export default function TeamsPage() {
  const { status } = auth.useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [teamName, setTeamName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.get<{ teams: TeamRow[] }>("/api/teams"),
    enabled: status === "authenticated",
  });

  const createTeam = useMutation({
    mutationFn: () =>
      api.post<{ id: string; inviteToken: string; inviteUrl: string }>("/api/teams", {
        name: teamName.trim(),
      }),
    onSuccess: (res) => {
      setInviteUrl(res.inviteUrl);
      qc.invalidateQueries({ queryKey: ["teams"] });
      setTeamName("");
      toast.success("Team created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Create a team, share the invite link, and keep projects moving.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border-border/70 bg-card rounded-2xl border p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-4" />
            <h2 className="text-lg font-semibold">Your teams</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : data && data.teams.length > 0 ? (
            <div className="space-y-3">
              {data.teams.map((team) => (
                <div key={team.id} className="border-border/70 bg-muted/20 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-muted-foreground text-xs">
                        Invite token: {team.inviteToken.slice(0, 8)}…
                      </p>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/teams/join/${team.inviteToken}`} />}
                    >
                      Open join link
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-dashed border-border/70 bg-muted/10 rounded-xl border p-5 text-sm text-muted-foreground">
              You are not on any teams yet.
            </div>
          )}
        </section>

        <section className="border-border/70 bg-card rounded-2xl border p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-4" />
            <h2 className="text-lg font-semibold">Create a new team</h2>
          </div>

          <div className="space-y-4">
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
            />
            <Button
              className="w-full"
              onClick={() => createTeam.mutate()}
              disabled={createTeam.isPending || teamName.trim().length === 0}
            >
              Create team
            </Button>

            {inviteUrl && (
              <div className="border-border/70 bg-muted/20 rounded-xl border p-4">
                <p className="mb-2 text-sm font-medium">Invite link</p>
                <p className="text-muted-foreground break-all text-xs">{inviteUrl}</p>
                <Button variant="outline" className="mt-3 w-full" onClick={copyInvite}>
                  <Copy className="size-4" /> Copy link
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
