import Link from "next/link";

import {
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  Check,
  ChevronsUpDown,
  Code2,
  Copy,
  FileDown,
  FileText,
  Gavel,
  Layers,
  Link2,
  Lock,
  type LucideIcon,
  MonitorPlay,
  Rocket,
  Scale,
  ScanSearch,
  ScrollText,
  Server,
  ShieldCheck,
  Sigma,
  Swords,
  Trophy,
  UsersRound,
  Vote,
  Webhook,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@juryza/ui/components/ui/accordion";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import { cn } from "@juryza/ui/lib/utils";

import { EventCover, NextMilestone, PhaseBadge } from "@/components/event-bits";
import { formatNumber, formatRange } from "@/lib/format";
import { featuredEvents, platformStats } from "@/lib/server/public";

/**
 * The public landing page: what Juryza is, why its judging is fair, and the
 * events running on this instance right now. Rendered on the server per
 * request with live platform numbers read straight from the database.
 */

export default async function LandingPage() {
  const [stats, events] = await Promise.all([platformStats(), featuredEvents(3)]);

  return (
    <div className="flex flex-col">
      <Hero />
      <StatsStrip stats={stats} />
      <Features />
      <HowItWorks />
      <Integrity />
      <LiveEvents events={events} />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                    */
/* ------------------------------------------------------------------ */

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6", className)}>{children}</div>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-primary text-sm font-semibold tracking-wide">{children}</p>;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto flex max-w-2xl flex-col items-center gap-3 text-center", className)}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description && (
        <p className="text-muted-foreground text-base text-pretty sm:text-lg">{description}</p>
      )}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "bg-background/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-xs backdrop-blur",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -z-10 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--primary), transparent), radial-gradient(closest-side at 80% 60%, var(--chart-2), transparent)",
        }}
      />
      <Container className="grid items-center gap-14 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <Pill>
            <span className="bg-success size-1.5 rounded-full" />
            Open source · Self-hosted · Works fully offline
          </Pill>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Hackathon judging{" "}
            <span className="from-primary to-chart-2 bg-linear-to-r bg-clip-text text-transparent">
              you can defend.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Juryza runs your whole hackathon — registration, teams, submissions, judging, community
            voting and published results — and makes the ranking{" "}
            <span className="text-foreground font-medium">statistically fair</span>. A harsh judge
            can't sink a project, and every score is on the record.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-10 px-4"
              nativeButton={false}
              render={<Link href="/manage/new" />}
            >
              Host a hackathon <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-10 px-4"
              nativeButton={false}
              render={<Link href="/events" />}
            >
              Browse events
            </Button>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Check className="text-success size-4" /> No cloud account
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="text-success size-4" /> One-command install
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="text-success size-4" /> MIT licensed
            </span>
          </div>
        </div>
        <HeroVisual />
      </Container>
    </section>
  );
}

const MOCK_ROWS = [
  { title: "Issue Radar", team: "Night Owls", raw: 3.7, z: 1.62, move: 3, hue: 285 },
  { title: "Carbon Ledger", team: "Greenfield", raw: 4.05, z: 1.31, move: 0, hue: 160 },
  { title: "Loop Assist", team: "Pair of Docs", raw: 3.45, z: 0.94, move: 2, hue: 30 },
  { title: "Quiet Hours", team: "Deep Work", raw: 4.15, z: 0.52, move: -3, hue: 220 },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="bg-card ring-foreground/10 relative overflow-hidden rounded-2xl shadow-2xl ring-1">
        <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="bg-foreground/15 size-2.5 rounded-full" />
            <span className="bg-foreground/15 size-2.5 rounded-full" />
            <span className="bg-foreground/15 size-2.5 rounded-full" />
          </div>
          <p className="text-muted-foreground truncate font-mono text-xs">
            juryza.local/e/sample-hack-2026/leaderboard
          </p>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Judged leaderboard</p>
              <p className="text-muted-foreground text-xs">41 projects · 30 judges · 123 reviews</p>
            </div>
            <div className="bg-muted text-muted-foreground inline-flex rounded-lg p-0.5 text-xs font-medium">
              <span className="rounded-md px-2.5 py-1">Raw mean</span>
              <span className="bg-background text-foreground rounded-md px-2.5 py-1 shadow-sm">
                Normalized
              </span>
            </div>
          </div>
          <ol className="flex flex-col divide-y rounded-xl border">
            {MOCK_ROWS.map((r, i) => (
              <li key={r.title} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold tabular-nums",
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className="size-8 shrink-0 rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, oklch(0.7 0.15 ${r.hue}), oklch(0.5 0.17 ${r.hue + 40}))`,
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{r.team}</p>
                </div>
                <div className="hidden w-24 flex-col gap-1 sm:flex">
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.min(100, (r.z / 1.8) * 100)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-right text-[0.7rem] tabular-nums">
                    raw {r.raw.toFixed(2)}
                  </p>
                </div>
                <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums">
                  {r.z > 0 ? "+" : ""}
                  {r.z.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "w-9 text-right text-xs font-medium tabular-nums",
                    r.move > 0 && "text-success",
                    r.move < 0 && "text-destructive",
                    r.move === 0 && "text-muted-foreground"
                  )}
                >
                  {r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : "—"}
                </span>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Impact", w: 30, c: "bg-chart-1" },
              { label: "Execution", w: 35, c: "bg-chart-2" },
              { label: "Innovation", w: 20, c: "bg-chart-3" },
              { label: "Demo", w: 15, c: "bg-chart-4" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-1.5 rounded-lg border p-2">
                <div className="bg-muted h-1 overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full", c.c)}
                    style={{ width: `${(c.w / 35) * 100}%` }}
                  />
                </div>
                <p className="truncate text-[0.7rem] font-medium">{c.label}</p>
                <p className="text-muted-foreground text-[0.7rem] tabular-nums">{c.w}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-popover ring-foreground/10 absolute -bottom-14 -left-3 hidden w-64 rounded-xl p-3 shadow-xl ring-1 sm:block lg:-left-10">
        <div className="flex items-center gap-2">
          <span className="bg-warning/20 text-warning-foreground grid size-7 place-items-center rounded-lg">
            <Sigma className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">Harsh judge detected</p>
            <p className="text-muted-foreground text-[0.7rem]">
              Judge #14 scores −0.8σ below the panel
            </p>
          </div>
        </div>
      </div>
      <div className="bg-popover ring-foreground/10 absolute -top-12 -right-3 hidden w-64 rounded-xl p-3 shadow-xl ring-1 sm:block lg:-right-6">
        <div className="flex items-center gap-2">
          <span className="bg-success/15 text-success grid size-7 place-items-center rounded-lg">
            <BadgeCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">Certificate verified</p>
            <p className="text-muted-foreground font-mono text-[0.7rem]">
              HMAC-SHA256 · JZ-7F3KQ-9MXA2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live stats                                                         */
/* ------------------------------------------------------------------ */

function StatsStrip({ stats }: { stats: Awaited<ReturnType<typeof platformStats>> }) {
  const items = [
    { label: "Events hosted", value: stats.events },
    { label: "Projects submitted", value: stats.projects },
    { label: "Participants", value: stats.participants },
    { label: "Judges on panels", value: stats.judges },
    { label: "Scores recorded", value: stats.scores },
    { label: "Community votes", value: stats.votes },
  ];
  return (
    <section className="bg-muted/30 border-b" aria-label="Live platform numbers">
      <Container className="flex flex-col gap-6 py-10">
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs font-medium tracking-widest uppercase">
          <span className="relative flex size-2">
            <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            <span className="bg-success relative inline-flex size-2 rounded-full" />
          </span>
          Live on this instance
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <dt className="text-muted-foreground order-2 text-sm">{s.label}</dt>
              <dd className="order-1 text-3xl font-semibold tracking-tight tabular-nums">
                {formatNumber(s.value)}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                           */
/* ------------------------------------------------------------------ */

const FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
  group: "Run" | "Judge" | "Integrate";
}[] = [
  {
    group: "Run",
    icon: CalendarRange,
    title: "Events & tracks",
    body: "Dates, tracks, prizes and rules in one place. The lifecycle follows the calendar — no manual phase flipping.",
  },
  {
    group: "Run",
    icon: Link2,
    title: "Teams by invite link",
    body: "Create a team, share one link. Max team size and deadlines are enforced by the backend, not the button.",
  },
  {
    group: "Run",
    icon: FileText,
    title: "Notion-style write-ups",
    body: "A block editor with slash commands for project pages — headings, checklists, code, embeds. Drafts until submit.",
  },
  {
    group: "Judge",
    icon: Scale,
    title: "Weighted rubric",
    body: "Organizer-defined criteria and weights. Judges score what matters; weights normalize to 100% automatically.",
  },
  {
    group: "Judge",
    icon: Lock,
    title: "Backend role isolation",
    body: "A judge can't read another judge's scores — not in the UI, not with a raw curl. Enforced on every request.",
  },
  {
    group: "Judge",
    icon: Sigma,
    title: "Z-score normalization",
    body: "Each judge's scores are standardized against their own mean and spread, so harsh and lenient judges count equally.",
  },
  {
    group: "Judge",
    icon: Swords,
    title: "Pairwise Bradley–Terry",
    body: "Prefer comparisons to absolute scores? Judges pick A vs B and a Bradley–Terry model turns that into a ranking.",
  },
  {
    group: "Judge",
    icon: Vote,
    title: "Quadratic community voting",
    body: "Voters spread a credit budget; n votes cost n². Enthusiasm counts, but a single fan club can't buy the prize.",
  },
  {
    group: "Judge",
    icon: ScanSearch,
    title: "Similarity & comparison",
    body: "Duplicate and near-duplicate submissions are flagged automatically, with side-by-side project comparison.",
  },
  {
    group: "Run",
    icon: ScrollText,
    title: "Readable audit trail",
    body: "Every submission, score, publish and permission change is logged with actor and time — in plain language.",
  },
  {
    group: "Integrate",
    icon: Webhook,
    title: "REST API, webhooks, OpenAPI",
    body: "Every UI action is an API call. Bearer tokens, signed webhooks and an OpenAPI 3.1 spec for your own tooling.",
  },
  {
    group: "Integrate",
    icon: BadgeCheck,
    title: "Verifiable certificates",
    body: "Signed certificates for winners and judges. Anyone can check a serial — tampered records fail verification.",
  },
  {
    group: "Integrate",
    icon: MonitorPlay,
    title: "Embeddable gallery",
    body: "Drop the public project gallery into your event site. Search and track filters come with it.",
  },
  {
    group: "Integrate",
    icon: FileDown,
    title: "CSV / JSON import-export",
    body: "Bulk-import projects, export scores and results. Your data leaves in open formats whenever you want.",
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow="Everything in the box"
          title="From first sign-up to signed certificate"
          description="One self-hosted app covers the whole event. No plugins to buy, no spreadsheet glue, no per-seat pricing."
        />
        <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-card group flex flex-col gap-3 p-6 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <span className="bg-primary/10 text-primary ring-primary/15 grid size-10 place-items-center rounded-xl ring-1">
                  <f.icon className="size-5" />
                </span>
                <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wider uppercase">
                  {f.group}
                </span>
              </div>
              <h3 className="font-semibold tracking-tight">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
          <div className="bg-card flex flex-col justify-between gap-4 p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold tracking-tight">Built to be read by machines, too</h3>
              <p className="text-muted-foreground text-sm">
                Browse the full API reference, or pull the spec straight into your client generator.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/docs/api" />}
              >
                <Code2 /> API reference
              </Button>
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<a href="/api/openapi.json" />}
              >
                openapi.json
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                       */
/* ------------------------------------------------------------------ */

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CalendarRange,
    title: "Create",
    body: "Set dates, tracks, prizes and a weighted rubric. Publish when ready.",
  },
  {
    icon: Rocket,
    title: "Submit",
    body: "Teams form by link and write their project up. The deadline is enforced server-side.",
  },
  {
    icon: Gavel,
    title: "Judge",
    body: "Assignments are balanced across the panel. Judges score blind to each other.",
  },
  {
    icon: Vote,
    title: "Vote",
    body: "The community spends quadratic credits on a randomized ballot.",
  },
  {
    icon: Trophy,
    title: "Publish",
    body: "Normalized results stay hidden until you publish. Certificates are signed.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-muted/30 scroll-mt-20 border-y py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow="How it works"
          title="Five steps, one timeline"
          description="Every event moves through the same lifecycle. Phases follow your dates, so nobody forgets to close submissions at midnight."
        />
        <ol className="relative grid gap-6 md:grid-cols-5 md:gap-4">
          <div
            aria-hidden
            className="bg-border absolute top-6 right-[10%] left-[10%] hidden h-px md:block"
          />
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative flex gap-4 md:flex-col md:items-center md:text-center"
            >
              <span className="bg-background ring-border text-primary relative grid size-12 shrink-0 place-items-center rounded-full shadow-sm ring-1">
                <s.icon className="size-5" />
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 grid size-5 place-items-center rounded-full text-[0.65rem] font-semibold">
                  {i + 1}
                </span>
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-muted-foreground text-sm text-pretty">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Judging integrity deep-dive                                        */
/* ------------------------------------------------------------------ */

const JUDGES = [
  { name: "Judge A", note: "lenient", mean: 4.3, sd: 0.3 },
  { name: "Judge B", note: "harsh", mean: 2.45, sd: 0.55 },
];

const COMPARISON = [
  { title: "Quiet Hours", judge: "A", raw: 4.55, z: 0.83, rawRank: 1, zRank: 3 },
  { title: "Carbon Ledger", judge: "A", raw: 4.45, z: 0.5, rawRank: 2, zRank: 4 },
  { title: "Issue Radar", judge: "B", raw: 3.4, z: 1.73, rawRank: 3, zRank: 1 },
  { title: "Loop Assist", judge: "B", raw: 3.1, z: 1.18, rawRank: 4, zRank: 2 },
];

function Integrity() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <Eyebrow>Judging integrity</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Luck of the draw shouldn't decide the winner
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            With 40 projects and 30 judges, no one sees everything. If your project lands with the
            toughest judge, a raw average quietly punishes you. Juryza compares each score to that
            judge's own habits first.
          </p>
          <div className="bg-muted/40 flex flex-col gap-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Per-judge standardization
            </p>
            <p className="font-mono text-lg">
              z = (x − μ<sub>judge</sub>) / σ<sub>judge</sub>
            </p>
            <p className="text-muted-foreground text-sm">
              Then the weighted rubric is applied and z-scores are averaged per project. Ties and
              single-review projects are handled explicitly — the method is documented, with a
              worked proof.
            </p>
          </div>
          <ul className="flex flex-col gap-3 text-sm">
            {[
              {
                icon: ShieldCheck,
                text: "Judges only ever see their own assignments and scores — enforced by the API.",
              },
              {
                icon: ChevronsUpDown,
                text: "Pairwise Bradley–Terry mode for events that prefer comparisons to scales.",
              },
              {
                icon: ScrollText,
                text: "Every score change lands in the audit trail, with who and when.",
              },
            ].map((b) => (
              <li key={b.text} className="flex items-start gap-3">
                <b.icon className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <Card className="gap-0 py-0 shadow-lg">
          <div className="grid grid-cols-2 gap-px border-b bg-border">
            {JUDGES.map((j) => (
              <div key={j.name} className="bg-card flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{j.name}</p>
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[0.7rem]">
                    {j.note}
                  </span>
                </div>
                <div className="bg-muted relative h-2 rounded-full">
                  <div
                    className="bg-primary/25 absolute inset-y-0 rounded-full"
                    style={{ left: `${(j.mean - j.sd * 1.5) * 20}%`, width: `${j.sd * 60}%` }}
                  />
                  <div
                    className="bg-primary absolute -top-0.5 size-3 -translate-x-1/2 rounded-full"
                    style={{ left: `${j.mean * 20}%` }}
                  />
                </div>
                <p className="text-muted-foreground font-mono text-xs">
                  μ {j.mean.toFixed(1)} · σ {j.sd.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-2 py-2.5 text-right font-medium">Raw</th>
                  <th className="px-2 py-2.5 text-right font-medium">Rank</th>
                  <th className="px-2 py-2.5 text-right font-medium">z</th>
                  <th className="px-4 py-2.5 text-right font-medium">Fair rank</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {COMPARISON.map((r) => (
                  <tr key={r.title}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-muted-foreground text-xs">reviewed by Judge {r.judge}</p>
                    </td>
                    <td className="text-muted-foreground px-2 py-3 text-right tabular-nums">
                      {r.raw.toFixed(1)}
                    </td>
                    <td className="text-muted-foreground px-2 py-3 text-right tabular-nums">
                      #{r.rawRank}
                    </td>
                    <td className="px-2 py-3 text-right font-mono tabular-nums">
                      +{r.z.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                          r.zRank < r.rawRank
                            ? "bg-success/15 text-success"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        #{r.zRank} {r.zRank < r.rawRank ? "▲" : "▼"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground bg-muted/40 border-t px-4 py-3 text-xs">
            Illustrative: Judge B's 6.8 is exceptional <em>for Judge B</em>. Raw averages hide that;
            normalization surfaces it.
          </p>
        </Card>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live events                                                        */
/* ------------------------------------------------------------------ */

function LiveEvents({ events }: { events: Awaited<ReturnType<typeof featuredEvents>> }) {
  return (
    <section className="bg-muted/30 border-y py-20 sm:py-28">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <Eyebrow>Happening here</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight">Events on this instance</h2>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
            All events <ArrowRight />
          </Button>
        </div>
        {events.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/e/${e.slug}`}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full gap-0 py-0 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                  <EventCover hue={e.hue} className="flex h-32 items-end p-4">
                    <PhaseBadge event={e} className="bg-white/15 text-white backdrop-blur" />
                  </EventCover>
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-semibold tracking-tight">{e.name}</h3>
                      {e.tagline && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">{e.tagline}</p>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1">
                        <CalendarRange className="size-3.5" />{" "}
                        {formatRange(e.submissionsOpen, e.submissionsClose)}
                      </span>
                      <span className="flex items-center gap-1">
                        <UsersRound className="size-3.5" /> {formatNumber(e.participants)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="size-3.5" /> {formatNumber(e.projects)} projects
                      </span>
                    </div>
                    <NextMilestone event={e} className="text-xs" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="items-center gap-3 py-12 text-center">
            <p className="font-semibold">No public events yet</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Be the first — create an event and it shows up here.
            </p>
            <Button nativeButton={false} render={<Link href="/manage/new" />}>
              Host a hackathon
            </Button>
          </Card>
        )}
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                */
/* ------------------------------------------------------------------ */

const FAQ = [
  {
    q: "Do I need a cloud account or an internet connection?",
    a: "No. `docker compose up` starts PostgreSQL and the app on one machine. There are no external APIs, CDNs or telemetry — it runs with the network cable unplugged.",
  },
  {
    q: "How exactly does score normalization work?",
    a: "For each judge we compute the mean and standard deviation of their weighted scores, convert every score to a z-score, then average z-scores per project. A judge with a single review, or zero variance, is handled explicitly. The method and a worked proof ship in the docs.",
  },
  {
    q: "Can a judge see how other judges scored?",
    a: "No. Isolation lives in the API, not the interface: the scores endpoints only ever return the caller's own rows, and organizers see aggregates. Try it with curl.",
  },
  {
    q: "What stops people gaming the community vote?",
    a: "Quadratic cost (n votes cost n² credits), a fixed per-voter budget, optional email-domain restrictions, rate limits, randomized ballot order and duplicate detection — all logged to the audit trail.",
  },
  {
    q: "When do participants see the results?",
    a: "Only when an organizer presses publish. Until then, the leaderboard is hidden from everyone except the event's managers.",
  },
  {
    q: "Can I plug it into my own tools?",
    a: "Yes. Every action in the UI is a REST call. Create API tokens in settings, subscribe to signed webhooks, and generate a client from the OpenAPI 3.1 spec.",
  },
];

function Faq() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div className="flex flex-col gap-3">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight">Questions organizers ask</h2>
          <p className="text-muted-foreground">
            Something else? The API reference documents every rule the backend enforces.
          </p>
        </div>
        <Accordion className="rounded-xl border px-5">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="py-4 text-base hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="bg-primary text-primary-foreground relative isolate overflow-hidden rounded-3xl px-6 py-14 shadow-xl sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse at right, black, transparent 70%)",
            }}
          />
          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Your next hackathon, judged fairly — running in one command.
              </h2>
              <p className="text-primary-foreground/80 max-w-xl text-lg">
                Self-host it on a laptop for a weekend event or a server for a season. Seeded with
                sample data so you can click through everything first.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-10 px-4"
                  nativeButton={false}
                  render={<Link href="/manage/new" />}
                >
                  Host a hackathon <ArrowRight />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="hover:bg-primary-foreground/10 hover:text-primary-foreground h-10 px-4"
                  nativeButton={false}
                  render={<Link href="/events" />}
                >
                  Browse events
                </Button>
              </div>
            </div>
            <div className="bg-foreground/90 text-background rounded-xl p-5 font-mono text-sm shadow-2xl ring-1 ring-black/10">
              <div className="mb-3 flex items-center justify-between opacity-60">
                <span className="flex items-center gap-2 text-xs">
                  <Server className="size-3.5" /> terminal
                </span>
                <Copy className="size-3.5" aria-hidden />
              </div>
              <p>
                <span className="opacity-50">$</span> git clone …/juryza && cd juryza
              </p>
              <p>
                <span className="opacity-50">$</span> docker compose up
              </p>
              <p className="mt-2 opacity-60">✓ postgres ready · schema pushed · fixtures seeded</p>
              <p className="opacity-60">✓ portal on http://localhost:8080</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
