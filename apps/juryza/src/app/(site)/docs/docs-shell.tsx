"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PanelLeft } from "lucide-react";

import { Button } from "@juryza/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@juryza/ui/components/ui/sheet";
import { cn } from "@juryza/ui/lib/utils";

import { DOC_LINKS } from "./docs-nav";

/**
 * Docs chrome: a sticky left rail on desktop and a slide-over on mobile, both
 * driven by `DOC_LINKS`. The API reference renders its own dense operation
 * index, so it opts out of the outer rail via `bare`.
 */

function isActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-1 text-sm">
      {DOC_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <link.icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{link.label}</span>
              <span className="text-muted-foreground text-xs leading-snug text-pretty">
                {link.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Routes that own their full-width layout and opt out of the outer rail. */
const BARE_ROUTES = ["/docs/api"];

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10 lg:py-12">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-24">
          <p className="text-muted-foreground mb-3 px-3 text-xs font-semibold tracking-wide uppercase">
            Documentation
          </p>
          <NavList pathname={pathname} />
        </div>
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2">
                <PanelLeft className="size-4" />
                Browse docs
              </Button>
            }
          />
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Documentation</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <NavList pathname={pathname} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
