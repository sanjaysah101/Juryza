import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { Logo } from "@/components/brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/events", label: "Browse events" },
      { href: "/leaderboard", label: "Global leaderboard" },
      { href: "/manage/new", label: "Host a hackathon" },
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How judging works" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/roles", label: "Roles & permissions" },
      { href: "/docs/api", label: "API reference" },
      { href: "/api/openapi.json", label: "OpenAPI spec" },
      {
        href: "https://github.com/sanjaysah101/Juryza",
        label: "GitHub repository",
        external: true,
      },
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

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/sanjaysah101/Juryza",
    icon: (
      <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/sanjaysah101",
    icon: (
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/sanjaysah101",
    icon: (
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    ),
  },
  {
    label: "Dev.to",
    href: "https://dev.to/sanjaysah",
    icon: (
      <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H5v4.36h1.58c.38 0 .66-.08.84-.23.18-.16.27-.42.27-.79v-2.32c0-.37-.09-.63-.27-.79zm3.89-2.05H4v8h3.31c.79 0 1.4-.2 1.83-.59.43-.39.65-.98.65-1.75v-3.32c0-.77-.22-1.36-.65-1.75-.43-.39-1.04-.59-1.83-.59zm4.24 8h1.74l2.12-5.42h-1.63l-1.36 3.82-1.36-3.82h-1.63l2.12 5.42zm4.45-8v1.5h1.5V11h-1.5v3.5h-1.5V8h3v1.5h-1.5z" />
      </svg>
    ),
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
            The self-hosted hackathon platform with judging you can defend. Open source, MIT
            licensed, runs on one machine.
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-2 pt-1">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex size-8 items-center justify-center rounded-lg border border-border/60 transition-colors"
                title={s.label}
                aria-label={s.label}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{c.title}</h3>
            <ul className="flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  {"external" in l && l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
                    >
                      {l.label}
                      <ExternalLink className="size-3 opacity-70" />
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
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
