"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { KeyRound, Settings, UserRound } from "lucide-react";

import { cn } from "@juryza/ui/lib/utils";

import { PageHeader } from "@/components/page";

/** Settings shell: a title and a tab bar between Profile, Account and API tokens. */

const TABS = [
  { href: "/settings/profile", label: "Profile", icon: UserRound },
  { href: "/settings/account", label: "Account", icon: Settings },
  { href: "/settings/tokens", label: "API tokens", icon: KeyRound },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Your public profile, sign-in and programmatic access."
      />
      <nav
        aria-label="Settings"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
                active
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="max-w-3xl">{children}</div>
    </div>
  );
}
