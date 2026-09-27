import Link from "next/link";

import { ArrowRight, Gavel, ScrollText, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@juryza/ui/components/ui/button";

/**
 * Landing page. Server component — no client state — so it renders instantly and
 * links into the role-appropriate areas. The real gate is the backend; these are
 * just entry points.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
        <span className="border-border bg-muted/50 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
          Submission &amp; judging, self-hosted
        </span>
        <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Run a hackathon that judges itself fairly.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Juryza takes a project from submission through weighted, role-isolated judging to
          normalized, published results — with an audit trail an organizer can actually read.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/gallery" />}>
            Browse the gallery <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/signup" />}>
            Get started
          </Button>
        </div>
      </section>

      <section className="border-border/60 bg-muted/20 border-t">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<ScrollText className="size-5" />}
            title="Configurable events"
            body="Dates, tracks, prizes and a weighted rubric — the criteria and their weights are yours to set."
          />
          <Feature
            icon={<ShieldCheck className="size-5" />}
            title="Backend role isolation"
            body="Judges never see each other's ballots. Enforced at the API, verified by a curl, not a hidden button."
          />
          <Feature
            icon={<Gavel className="size-5" />}
            title="Documented normalization"
            body="Per-judge z-score normalization evens out hot and cold judges. The maths is written down and defended."
          />
          <Feature
            icon={<Trophy className="size-5" />}
            title="Results you can export"
            body="CSV at every stage, an audit trail, and a migration path in and out. A platform you can leave."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{body}</p>
    </div>
  );
}
