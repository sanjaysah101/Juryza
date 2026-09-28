import type { Metadata } from "next";

/**
 * Chrome-free layout for the embeddable gallery widget: no site header or
 * footer, so the page can sit inside an iframe on any site. Theme and
 * background are set by the page from its query string.
 */
export const metadata: Metadata = {
  title: "Project gallery",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: LayoutProps<"/embed/[slug]">) {
  return <div className="text-foreground">{children}</div>;
}
