import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ViewerProvider } from "@/components/viewer";
import { loadViewer } from "@/lib/server/viewer";

/** Public pages: marketing header and footer; signed-in state for the header. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await loadViewer();
  return (
    <ViewerProvider viewer={viewer}>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </div>
    </ViewerProvider>
  );
}
