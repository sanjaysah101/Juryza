"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignInForm } from "@juryza/auth-ui";
import { Separator } from "@juryza/ui/components/ui/separator";

import { auth, signInInputSchema } from "@/lib/auth";

const demoAccounts = [
  { role: "Organizer", email: "organizer@juryza.test", password: "organizer-password-123" },
  { role: "Judge", email: "judge.a@juryza.test", password: "judge-a-password-123" },
  { role: "Judge", email: "judge.b@juryza.test", password: "judge-b-password-123" },
  { role: "Participant", email: "participant@juryza.test", password: "participant-password-123" },
];

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Sign in to submit, judge, or organize.</p>
          </div>

          <div className="mt-6">
            <SignInForm
              contract={auth}
              signInSchema={signInInputSchema}
              onSuccess={() => {
                router.push("/dashboard");
                router.refresh();
              }}
            />
          </div>

          <Separator className="my-6" />
          <p className="text-muted-foreground text-center text-sm">
            No account?{" "}
            <Link
              href="/signup"
              className="text-foreground font-medium underline underline-offset-4"
            >
              Create one
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Demo access</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Use these seeded credentials to explore the app as each role.
          </p>

          <div className="mt-5 space-y-3">
            {demoAccounts.map((account) => (
              <div
                key={`${account.role}-${account.email}`}
                className="rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{account.role}</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Email: {account.email}</p>
                  <p>Password: {account.password}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
