import { ManageChrome } from "./manage-chrome";

/** The organizer console for one event: event header above every section. */
export default async function ManageEventLayout({
  children,
  params,
}: LayoutProps<"/manage/[slug]">) {
  const { slug } = await params;
  return <ManageChrome slug={slug}>{children}</ManageChrome>;
}
