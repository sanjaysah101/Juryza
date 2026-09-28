import { EventChrome } from "./event-chrome";

/** Public event pages share the cover hero and tab bar. */
export default async function EventLayout({ children, params }: LayoutProps<"/e/[slug]">) {
  const { slug } = await params;
  return <EventChrome slug={slug}>{children}</EventChrome>;
}
