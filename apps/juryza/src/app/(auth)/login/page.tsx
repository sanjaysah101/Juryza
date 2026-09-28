"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Gavel, Megaphone, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import { Spinner } from "@juryza/ui/components/ui/spinner";

import { signIn } from "@/lib/auth-client";

const DEMO = [
  {
    label: "Organizer",
    email: "organizer@juryza.test",
    password: "organizer-password-123",
    icon: Megaphone,
  },
  { label: "Judge", email: "judge.a@juryza.test", password: "judge-a-password-123", icon: Gavel },
  {
    label: "Participant",
    email: "participant@juryza.test",
    password: "participant-password-123",
    icon: UserRound,
  },
  { label: "Admin", email: "admin@juryza.test", password: "admin-password-123", icon: ShieldCheck },
];

function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const submit = async (e: string, p: string, key: string) => {
    setPending(key);
    const { error } = await signIn.email({ email: e, password: p });
    setPending(null);
    if (error) {
      toast.error(error.message ?? "Could not sign in");
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your Juryza workspace.</p>
      </div>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit(email, password, "form");
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending !== null}>
            {pending === "form" && <Spinner />} Sign in
          </Button>
        </FieldGroup>
      </form>

      <FieldSeparator>Or explore with a demo account</FieldSeparator>
      <div className="grid grid-cols-2 gap-2">
        {DEMO.map((d) => (
          <Button
            key={d.label}
            variant="outline"
            disabled={pending !== null}
            onClick={() => void submit(d.email, d.password, d.label)}
          >
            {pending === d.label ? <Spinner /> : <d.icon />} {d.label}
          </Button>
        ))}
      </div>
      <FieldDescription className="text-center">
        No account?{" "}
        <Link
          href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-foreground underline underline-offset-4"
        >
          Create one
        </Link>
      </FieldDescription>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
