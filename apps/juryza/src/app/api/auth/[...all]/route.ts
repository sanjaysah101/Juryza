import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/server/auth";

/** Better Auth's own endpoints — sign-in, sign-up, sign-out, session, reset. */
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
