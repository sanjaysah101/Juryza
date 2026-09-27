"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignInForm } from "@juryza/auth-ui";
import { Separator } from "@juryza/ui/components/ui/separator";

import { auth, signInInputSchema } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to submit, judge, or organize.</p>
      </div>

      <SignInForm
        contract={auth}
        signInSchema={signInInputSchema}
        onSuccess={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />

      <Separator />
      <p className="text-muted-foreground text-center text-sm">
        No account?{" "}
        <Link href="/signup" className="text-foreground font-medium underline underline-offset-4">
          Create one
        </Link>
      </p>
    </main>
  );
}
