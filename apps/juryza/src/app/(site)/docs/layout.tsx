import { DocsShell } from "./docs-shell";

/**
 * Shared chrome for every `/docs/*` page: the left navigation rail plus the
 * page content. The shell reads the current route to highlight the active
 * entry, so this layout stays a thin server wrapper.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
