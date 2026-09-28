"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@juryza/ui/components/ui/breadcrumb";
import { Separator } from "@juryza/ui/components/ui/separator";
import { SidebarTrigger } from "@juryza/ui/components/ui/sidebar";
import { ThemeToggle } from "@juryza/ui/theme/theme-toggle";

import type { Viewer } from "@/components/viewer";

import { CommandMenu } from "./command-menu";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  teams: "Teams",
  judging: "Judging",
  pairwise: "Pairwise",
  manage: "Organize",
  new: "New event",
  settings: "Settings",
  profile: "Profile",
  account: "Account",
  tokens: "API tokens",
  admin: "Admin",
  users: "Users",
  tracks: "Tracks & prizes",
  rubric: "Rubric",
  judges: "Judges",
  assignments: "Assignments",
  submissions: "Projects",
  participants: "Participants",
  results: "Results",
  voting: "Voting",
  announcements: "Announcements",
  certificates: "Certificates",
  integrations: "Integrations",
  data: "Import & export",
  audit: "Audit log",
};

// Record ids (prj_…, tm_…) are meaningless in a breadcrumb; name the page instead.
const ID_LABEL: Record<string, string> = { projects: "Editor", teams: "Team" };
const label = (seg: string, parent?: string) =>
  LABELS[seg] ??
  (/^[a-z]{2,5}_[a-z0-9]{6,}$/.test(seg)
    ? (ID_LABEL[parent ?? ""] ?? "Details")
    : decodeURIComponent(seg).replace(/-/g, " "));

export function AppHeader({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {segments.map((seg, i) => {
            const href = `/${segments.slice(0, i + 1).join("/")}`;
            const last = i === segments.length - 1;
            return (
              <Fragment key={href}>
                {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                <BreadcrumbItem className={last ? "min-w-0" : "hidden sm:inline-flex"}>
                  {last ? (
                    <BreadcrumbPage className="truncate capitalize">
                      {label(seg, segments[i - 1])}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="capitalize" render={<Link href={href} />}>
                      {label(seg, segments[i - 1])}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-2">
        <CommandMenu viewer={viewer} />
        <ThemeToggle />
      </div>
    </header>
  );
}
