<!-- Vendored into this project from notils/create-notils. -->

> **This is your code.** `@juryza/auth-ui` lives at `packages/auth-ui` in this
> repository — edit it freely. Upstream source and design notes:
> <https://github.com/notils/create-notils>

# @juryza/auth-ui

Tier 1 auth UI components — `<SignInForm/>`, `<SignUpForm/>`, `<ForgotPasswordForm/>`, `<SessionStatus/>`, `<ProtectedRoute/>`. See [docs/packages-and-providers-architecture.md](https://github.com/notils/create-notils/blob/main/docs/packages-and-providers-architecture.md) for the Tier 1 / Tier 2 split this package implements.

Every component here is driven only by [`AuthContract`](../auth-custom/src/contract.ts) — never a specific provider. The same components render identically whether the contract comes from [`@juryza/auth-custom`](../auth-custom) (custom backend) or, once built, a Better Auth provider. Swapping providers means swapping what implements `AuthContract`, never touching this package.

## What's inside

```
src/
├── sign-in-form.tsx           # <SignInForm contract={...} signInSchema={...} />
├── sign-up-form.tsx           # <SignUpForm contract={...} signUpSchema={...} />
├── forgot-password-form.tsx   # <ForgotPasswordForm contract={...} /> — owns its own email-only schema
├── session-status.tsx         # <SessionStatus contract={...} renderUser={...} fallback={...} />
├── protected-route.tsx        # <ProtectedRoute contract={...} onUnauthenticated={...}>
└── index.ts                   # public exports
```

Forms are built on [`@juryza/form-builder`](../form-builder)'s `<SchemaForm/>` — the sign-in/sign-up field layout comes entirely from the schema you pass in, not hardcoded markup here.

## Why `signInSchema`/`signUpSchema` are separate props, not derived from the contract

`AuthContract.signIn(input: TSignIn)` describes *behavior*, not the input's shape — `TSignIn`/`TSignUp` are generic. The schema itself lives wherever you configured your provider (e.g. `CustomBackendAuthConfig.signInInputSchema` in `@juryza/auth-custom`), so these components take it as an explicit prop rather than trying to extract it from the contract at runtime.

`ForgotPasswordForm` is the exception — `requestPasswordReset(email: string)` has a fixed, non-generic shape, so the component owns its own minimal `z.object({ email: z.string().email() })` schema instead of requiring one as a prop.

## `ProtectedRoute` is framework-agnostic on purpose

It gates `children` on session status but does **not** redirect itself — that's `next/navigation`'s job, not something this package should assume (a future non-Next.js target would need a different redirect mechanism). Wire your own redirect:

```tsx
"use client";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@juryza/auth-ui/protected-route";

function DashboardPage() {
  const router = useRouter();
  return (
    <ProtectedRoute contract={auth} onUnauthenticated={() => router.replace("/login")}>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

## Usage

```tsx
import { z } from "zod";
import { SignInForm } from "@juryza/auth-ui/sign-in-form";

const signInSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

function LoginPage() {
  return (
    <SignInForm
      contract={auth} // an AuthContract from your configured provider
      signInSchema={signInSchema}
      onSuccess={() => router.push("/dashboard")}
    />
  );
}
```

## Status

Built and typechecked; verified end-to-end (all five components) via a real Next.js production build against a fake `AuthContract`. Tier 2 flows (2FA, passkey, SSO, magic link) are deliberately **not** here — those are provider-specific and will live alongside the Better Auth provider once it's built, not in this package.

## Verify

```bash
bun run typecheck   # from this package, or from the repo root for the whole workspace
```
