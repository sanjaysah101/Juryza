"use client";

import { useState } from "react";
import Link from "next/link";

import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Button } from "@juryza/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";

import { authClient } from "@/lib/auth-client";

/**
 * Password reset. Juryza runs offline with no mail provider, so the reset link
 * is written to the server log; a production deployment plugs a mailer into
 * `sendResetPassword` in lib/server/auth.ts.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-muted-foreground text-sm">We'll send a reset link to your email.</p>
      </div>
      {sent ? (
        <Alert>
          <MailCheck />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account exists for {email}, a reset link is on its way. (Self-hosted without
            email? The link is in the server log.)
          </AlertDescription>
        </Alert>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await authClient.requestPasswordReset({
              email,
              redirectTo: "/reset-password",
            });
            if (error) toast.error(error.message ?? "Something went wrong");
            else setSent(true);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit">Send reset link</Button>
          </FieldGroup>
        </form>
      )}
      <FieldDescription className="text-center">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      </FieldDescription>
    </div>
  );
}
