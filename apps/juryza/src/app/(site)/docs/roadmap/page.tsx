import type { Metadata } from "next";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BrainCircuit,
  Contact,
  GitBranch,
  Globe,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@juryza/ui/components/ui/card";

import { DocHeader, DocSection, Pill, Prose } from "../docs-prose";

export const metadata: Metadata = {
  title: "Roadmap — Juryza docs",
  description: "What Juryza ships today and the integrations and features planned next.",
};

type Status = "shipped" | "planned" | "exploring";

interface Item {
  title: string;
  icon: LucideIcon;
  status: Status;
  body: string;
}

const STATUS: Record<Status, { label: string; tone: "success" | "primary" | "warning" }> = {
  shipped: { label: "Shipped", tone: "success" },
  planned: { label: "Planned", tone: "primary" },
  exploring: { label: "Exploring", tone: "warning" },
};

const INTEGRATIONS: Item[] = [
  {
    title: "GitHub integration",
    icon: GitBranch,
    status: "planned",
    body: "Link a repo to a project and verify ownership via the connected GitHub account, so a submission's code can be trusted to belong to its team. Pull commit activity within the hackathon window to flag work done before the start, surface language/stack automatically, and let judges open the diff since kickoff. A future step: gate community voting behind a verified GitHub account to raise the cost of Sybil identities.",
  },
  {
    title: "LinkedIn integration",
    icon: Contact,
    status: "exploring",
    body: "Optional identity signal, not a voting channel. Let participants attach a verified LinkedIn profile to their public Juryza profile for credibility, and let winners share certificates directly. Community voting will never run on LinkedIn reactions — that is precisely the failure mode the voting-integrity guide documents.",
  },
  {
    title: "Single sign-on & OAuth providers",
    icon: Globe,
    status: "planned",
    body: "Google, GitHub and Discord sign-in through Better Auth, so an event can require a real, provider-verified identity to participate or vote without running its own email flow.",
  },
];

const PLATFORM: Item[] = [
  {
    title: "Write-up quest & judge runoff",
    icon: ShieldCheck,
    status: "planned",
    body: "A structured public write-up challenge on shortlisted teams, with the judging panel holding final authority over the pick — replacing brigadeable open polls. See the voting-integrity guide for the design.",
  },
  {
    title: "Curated electorate lock",
    icon: Users,
    status: "planned",
    body: "Freeze the eligible voter roster at a snapshot taken before the event starts, so accounts created during the hackathon cannot vote — closing the “member before kickoff” loophole automatically instead of by manual check.",
  },
  {
    title: "Duplicate & AI-slop detection",
    icon: ScanSearch,
    status: "shipped",
    body: "TF-IDF cosine similarity plus same-repo/title matching already surface look-alike and duplicate submissions on the compare view.",
  },
  {
    title: "Shared rate-limit storage",
    icon: ShieldCheck,
    status: "planned",
    body: "Move rate limits and the anon-per-IP cap from process memory to shared storage (Redis) so they hold across multiple app instances, not just one container.",
  },
  {
    title: "Smarter notifications",
    icon: Bell,
    status: "exploring",
    body: "Digest emails and webhooks for deadline reminders, assignment nudges and results — building on the existing per-subscription signed webhooks.",
  },
  {
    title: "Assisted judging insights",
    icon: BrainCircuit,
    status: "exploring",
    body: "Optional, transparent aids for organizers: outlier-score flags, judge-agreement summaries and rubric-coverage gaps — never an automated verdict.",
  },
];

function ItemCard({ item }: { item: Item }) {
  const status = STATUS[item.status];
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <item.icon className="size-4" />
            </span>
            {item.title}
          </span>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">{item.body}</p>
      </CardContent>
    </Card>
  );
}

/** Roadmap: integrations and platform features, tagged by status. */
export default function RoadmapPage() {
  return (
    <div className="flex flex-col gap-10">
      <DocHeader
        eyebrow="Roadmap"
        title="Where Juryza is going"
        lead="Juryza is production-first today. This is the direction of travel — integrations that add trustworthy identity signals, and platform features that harden judging and voting further. Statuses are honest: shipped, planned, or still being explored."
      />

      <DocSection title="Integrations">
        <Prose>
          The theme is verified identity, not more places to click a button. Every integration is
          optional and additive.
        </Prose>
        <div className="grid gap-4">
          {INTEGRATIONS.map((item) => (
            <ItemCard key={item.title} item={item} />
          ))}
        </div>
      </DocSection>

      <DocSection title="Platform & integrity">
        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORM.map((item) => (
            <ItemCard key={item.title} item={item} />
          ))}
        </div>
      </DocSection>
    </div>
  );
}
