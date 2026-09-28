import Link from "next/link";

import { Logo } from "@/components/brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/events", label: "Browse events" },
      { href: "/manage/new", label: "Host a hackathon" },
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How judging works" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/api", label: "API reference" },
      { href: "/api/openapi.json", label: "OpenAPI spec" },
      { href: "/settings/tokens", label: "API tokens" },
      { href: "/certificates", label: "Verify a certificate" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create account" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm">
            The self-hosted hackathon platform with judging you can defend. Open source, MIT
            licensed, runs on one machine.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{c.title}</h3>
            <ul className="flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-col gap-2 border-t px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Juryza contributors · MIT License</span>
        <span>Built for DOGFOOD 2026 · Runs fully offline</span>
      </div>
    </footer>
  );
}
