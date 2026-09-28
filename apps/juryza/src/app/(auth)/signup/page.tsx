"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import { Spinner } from "@juryza/ui/components/ui/spinner";

import { authClient } from "@/lib/auth-client";

function SignupForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">Join hackathons, form a team and ship.</p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          const { error } = await authClient.signUp.email(form);
          setPending(false);
          if (error) {
            toast.error(error.message ?? "Could not create the account");
            return;
          }
          toast.success("Welcome to Juryza!");
          router.push(next);
          router.refresh();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />} Create account
          </Button>
        </FieldGroup>
      </form>
      <FieldDescription className="text-center">
        Already have an account?{" "}
        <Link
          href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </FieldDescription>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
