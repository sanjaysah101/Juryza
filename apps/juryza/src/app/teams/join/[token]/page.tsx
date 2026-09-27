"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function TeamJoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { status } = auth.useSession();
  const token = params?.token ?? "";
  const processedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const joinTeam = useMutation({
    mutationFn: () =>
      api.post<{ teamId: string; teamName: string }>("/api/teams/join", { inviteToken: token }),
    onSuccess: () => {
      toast.success("Welcome to the team");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    if (processedTokenRef.current === token) return;

    processedTokenRef.current = token;
    joinTeam.mutate();
  }, [status, token, joinTeam]);

  if (status !== "authenticated") {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-6 py-20">
      <div className="border-border/70 bg-card w-full rounded-2xl border p-8 text-center shadow-sm">
        {joinTeam.isPending && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin" />
            <h1 className="mt-4 text-2xl font-semibold">Joining team…</h1>
            <p className="text-muted-foreground mt-2">
              Checking the invite link and adding you to the project group.
            </p>
          </>
        )}

        {!joinTeam.isPending && joinTeam.isSuccess && (
          <>
            <div className="bg-emerald-500/10 text-emerald-600 mx-auto grid size-12 place-items-center rounded-full">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="mt-4 text-2xl font-semibold">You’re in.</h1>
            <p className="text-muted-foreground mt-2">
              Your invite was accepted and you can start managing submissions.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button nativeButton={false} render={<Link href="/dashboard" />}>
                Go to dashboard
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href="/teams" />}>
                View teams
              </Button>
            </div>
          </>
        )}

        {!joinTeam.isPending && joinTeam.isError && (
          <>
            <h1 className="text-2xl font-semibold">That invite didn’t work.</h1>
            <p className="text-muted-foreground mt-2">The link may be expired or already used.</p>
            <div className="mt-6 flex justify-center">
              <Button nativeButton={false} render={<Link href="/teams" />}>
                Back to teams
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
