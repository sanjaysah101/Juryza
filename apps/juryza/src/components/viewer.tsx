"use client";

import { createContext, useContext } from "react";

import type { Role } from "@/lib/roles";

/**
 * The signed-in person, resolved on the server by the layout and handed to
 * client components. Presentation only — every permission is re-checked by the
 * API on each request.
 */
export interface Viewer {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  role: Role;
  judgeEvents: number;
}

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: React.ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export const useViewer = () => useContext(ViewerContext);
