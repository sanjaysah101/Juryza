import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@juryza/ui/components/ui/sidebar";

import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { ViewerProvider } from "@/components/viewer";
import { loadViewer } from "@/lib/server/viewer";

/**
 * The signed-in workspace: sidebar, header, command palette. Anonymous visitors
 * are sent to sign in and brought back afterwards. (Every API call these pages
 * make is authorized again on the server.)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await loadViewer();
  if (!viewer) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return (
    <ViewerProvider viewer={viewer}>
      <SidebarProvider>
        <AppSidebar viewer={viewer} />
        <SidebarInset className="min-w-0">
          <AppHeader viewer={viewer} />
          <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ViewerProvider>
  );
}
