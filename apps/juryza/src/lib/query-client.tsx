"use client";

import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query provider for all client-side data fetching.
 *
 * The client is created inside `useState` so it is stable across re-renders but
 * created per-request on the server — the pattern Next's App Router wants, since
 * a module-level singleton would leak cache between users in RSC.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
