import Link from "next/link";

import { cn } from "@juryza/ui/lib/utils";

/** The Juryza mark: a gavel-shaped "J" in a rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-lg shadow-sm",
        className
      )}
      aria-hidden
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="M14 4v9.5a4.5 4.5 0 0 1-9 0" />
        <path d="M11 4h6" />
        <path d="M19 15l-2.5 2.5" opacity=".7" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <LogoMark />
      <span className="text-[1.05rem]">Juryza</span>
    </Link>
  );
}
