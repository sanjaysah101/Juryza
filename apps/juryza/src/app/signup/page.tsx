"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SignUpForm } from "@juryza/auth-ui";
import { Separator } from "@juryza/ui/components/ui/separator";

import { auth, signUpInputSchema } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          You start as a participant. Organizers can promote you to judge or organizer.
        </p>
      </div>

      <SignUpForm
        contract={auth}
        signUpSchema={signUpInputSchema}
        onSuccess={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />

      <Separator />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
