import {
  Award,
  BarChart3,
  CalendarPlus,
  ClipboardCheck,
  Compass,
  Database,
  FileCode2,
  FolderKanban,
  Gauge,
  Gavel,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  PlugZap,
  ScrollText,
  Settings,
  ShieldCheck,
  Shuffle,
  Tags,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  Vote,
} from "lucide-react";

import type { Viewer } from "@/components/viewer";
import { hasAtLeast } from "@/lib/roles";

/** Sidebar navigation, derived from the viewer's role and judging panels. */

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function mainNav(viewer: Viewer): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/events", label: "Explore events", icon: Compass },
      ],
    },
    {
      label: "Participate",
      items: [
        { href: "/projects", label: "My projects", icon: FolderKanban },
        { href: "/teams", label: "My teams", icon: UsersRound },
      ],
    },
  ];
  if (viewer.judgeEvents > 0 || viewer.role === "judge") {
    groups.push({
      label: "Judge",
      items: [{ href: "/judging", label: "Judging queue", icon: Gavel }],
    });
  }
  if (hasAtLeast(viewer.role, "organizer")) {
    groups.push({
      label: "Organize",
      items: [
        { href: "/manage", label: "My events", icon: Gauge, exact: true },
        { href: "/manage/new", label: "New event", icon: CalendarPlus },
      ],
    });
  }
  if (viewer.role === "admin") {
    groups.push({
      label: "Admin",
      items: [{ href: "/admin/users", label: "Users & roles", icon: ShieldCheck }],
    });
  }
  groups.push({
    label: "Account",
    items: [
      { href: "/settings/profile", label: "Profile", icon: UserRound },
      { href: "/settings/account", label: "Account", icon: Settings },
      { href: "/settings/tokens", label: "API tokens", icon: KeyRound },
    ],
  });
  return groups;
}

/** The per-event console shown while inside /manage/<slug>. */
export function manageNav(slug: string): NavGroup[] {
  const base = `/manage/${slug}`;
  return [
    {
      label: "Event",
      items: [
        { href: base, label: "Overview", icon: BarChart3, exact: true },
        { href: `${base}/settings`, label: "Details & dates", icon: Settings },
        { href: `${base}/tracks`, label: "Tracks & prizes", icon: Tags },
        { href: `${base}/announcements`, label: "Announcements", icon: Megaphone },
      ],
    },
    {
      label: "Submissions",
      items: [
        { href: `${base}/participants`, label: "Participants & teams", icon: Users },
        { href: `${base}/submissions`, label: "Projects", icon: FolderKanban },
      ],
    },
    {
      label: "Judging",
      items: [
        { href: `${base}/rubric`, label: "Rubric", icon: ListChecks },
        { href: `${base}/judges`, label: "Judges", icon: Gavel },
        { href: `${base}/assignments`, label: "Assignments", icon: Shuffle },
        { href: `${base}/results`, label: "Results", icon: Trophy },
      ],
    },
    {
      label: "Community",
      items: [{ href: `${base}/voting`, label: "Voting & integrity", icon: Vote }],
    },
    {
      label: "Operations",
      items: [
        { href: `${base}/certificates`, label: "Certificates", icon: Award },
        { href: `${base}/integrations`, label: "Webhooks & embed", icon: PlugZap },
        { href: `${base}/data`, label: "Import & export", icon: Database },
        { href: `${base}/audit`, label: "Audit log", icon: ScrollText },
      ],
    },
  ];
}

export const extraCommands: NavItem[] = [
  { href: "/docs/api", label: "API reference", icon: FileCode2 },
  { href: "/certificates", label: "Verify a certificate", icon: ClipboardCheck },
];
