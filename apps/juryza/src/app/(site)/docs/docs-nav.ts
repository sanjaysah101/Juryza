import type { LucideIcon } from "lucide-react";
import { BookOpen, Compass, FileJson, Milestone, ShieldCheck, Sparkles, Users } from "lucide-react";

/**
 * The documentation table of contents. One source of truth for the docs
 * sidebar (`docs-shell.tsx`) and the hub landing (`page.tsx`), so a new page is
 * added in exactly one place.
 */

export interface DocLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Shown on the hub as a short "what you'll find" tagline. */
  eyebrow: string;
}

export const DOC_LINKS: DocLink[] = [
  {
    href: "/docs",
    label: "Overview",
    description: "What Juryza is, how it fits together, and where to go next.",
    icon: Compass,
    eyebrow: "Start here",
  },
  {
    href: "/docs/roles",
    label: "Roles & permissions",
    description: "What participants, judges, organizers, and admins can and should do.",
    icon: Users,
    eyebrow: "Access & governance",
  },
  {
    href: "/docs/guide",
    label: "Tutorial",
    description: "Step-by-step walkthroughs for participants, judges and organizers.",
    icon: BookOpen,
    eyebrow: "Learn the app",
  },
  {
    href: "/docs/about",
    label: "About the project",
    description: "The problem, the architecture, and the decisions behind Juryza.",
    icon: Sparkles,
    eyebrow: "Understand the design",
  },
  {
    href: "/docs/voting",
    label: "Voting integrity",
    description: "Why community voting keeps breaking — and how Juryza answers each failure.",
    icon: ShieldCheck,
    eyebrow: "The hard problem",
  },
  {
    href: "/docs/roadmap",
    label: "Roadmap",
    description: "What's shipped and what's next: integrations and future features.",
    icon: Milestone,
    eyebrow: "Where it's going",
  },
  {
    href: "/docs/api",
    label: "API reference",
    description: "Every endpoint, generated live from the OpenAPI spec.",
    icon: FileJson,
    eyebrow: "Build on it",
  },
];
