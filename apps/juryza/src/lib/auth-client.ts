"use client";

import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The browser's Better Auth client: sign in/up/out and the session hook.
 * Same-origin, so no base URL is needed. Server code uses `lib/server/auth.ts`.
 */
export const authClient = createAuthClient({ plugins: [adminClient()] });

export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
