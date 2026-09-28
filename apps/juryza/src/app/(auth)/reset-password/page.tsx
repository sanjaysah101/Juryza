"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";

import { authClient } from "@/lib/auth-client";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-muted-foreground text-sm">At least 8 characters.</p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await authClient.resetPassword({ newPassword: password, token });
          if (error) {
            toast.error(error.message ?? "This reset link is invalid or expired");
            return;
          }
          toast.success("Password updated — sign in with your new password");
          router.push("/login");
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!token}>
            Update password
          </Button>
        </FieldGroup>
      </form>
      <FieldDescription className="text-center">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      </FieldDescription>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
