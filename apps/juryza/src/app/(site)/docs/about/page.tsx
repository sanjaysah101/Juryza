import type { Metadata } from "next";
import Link from "next/link";

import { Layers, Scale, Server, ShieldCheck, Sigma, Swords } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";

import { DocHeader, DocSection, KeyValue, Prose } from "../docs-prose";

export const metadata: Metadata = {
  title: "About the project — Juryza docs",
  description:
    "What Juryza is, the architecture behind it, and the decisions that make its judging defensible.",
};

/** Project overview: the problem, the shape of the system, and the maths. */
export default function AboutPage() {
  return (
    <div className="flex flex-col gap-10">
      <DocHeader
        eyebrow="About the project"
        title="What Juryza is"
        lead="Juryza is an open, API-first platform for running hackathons end to end — submissions, judging, community voting, results and certificates — with a judging pipeline built to survive scrutiny. It was built for the Hackathon Raptors community, whose events surface exactly the problems it solves."
      />

      <DocSection title="The problem" icon={Swords}>
        <Prose>
          Judging a hackathon fairly is harder than it looks. Judges disagree on how to use a 1–5
          scale; a project&apos;s rank should not depend on which judge happened to draw it.
          Community votes get brigaded. Deadlines get gamed. Results leak before they are meant to.
          Most tools treat these as UI problems; Juryza treats them as backend guarantees.
        </Prose>
        <Alert>
          <ShieldCheck />
          <AlertTitle>The API is the only trust boundary</AlertTitle>
          <AlertDescription>
            Every route resolves the caller and checks permission itself. The UI is untrusted and
            hides nothing the API would otherwise hand out — the app&apos;s own pages use the same
            REST API as any script.
          </AlertDescription>
        </Alert>
      </DocSection>

      <DocSection title="Architecture" icon={Server}>
        <Prose>
          One Next.js app (App Router, React Server Components) serves both the UI and the REST API,
          backed by PostgreSQL through Drizzle. The whole persistence model is a single schema file,
          and every id carries a type prefix so a value in a log says what it is.
        </Prose>
        <KeyValue
          items={[
            { term: "Framework", detail: "Next.js 16 · React 19 · React Compiler" },
            { term: "Data", detail: "PostgreSQL 18 · Drizzle ORM · one schema file" },
            { term: "Auth", detail: "Better Auth (sessions) + hashed personal API tokens" },
            { term: "UI", detail: "Tailwind v4 · shadcn/ui on Base UI · TanStack Query" },
            { term: "Tooling", detail: "Bun · Turborepo · Biome" },
          ]}
        />
      </DocSection>

      <DocSection title="Derived, never duplicated" icon={Layers}>
        <Prose>
          Phase, weighted scores, normalized scores, ranks, awards and vote tallies are all computed
          on read from primary facts — there is no cache to invalidate and no way for two screens to
          disagree. Re-weight the rubric or edit a score and every surface reflects it on the next
          read. Uniqueness constraints carry the integrity rules: one score per judge per project,
          one vote per voter per project, one assignment per pair.
        </Prose>
      </DocSection>

      <DocSection id="judging" title="How the judging maths works" icon={Sigma}>
        <Prose>
          Judges differ in two systematic ways: level (generous vs harsh) and spread (using 1–5 vs
          3–4). Averaging raw marks lets a project&apos;s rank depend on its judges. Juryza removes
          both effects per judge with a z-score, then maps back to the familiar 1–5 scale:
        </Prose>
        <pre className="bg-muted/60 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-relaxed">
          <code>{`μ_j, σ_j   = mean and standard deviation of judge j's raw scores
z          = (raw − μ_j) / σ_j
normalized = clamp(globalMean + z · 0.9, 1, 5)
project    = mean of its normalized scores`}</code>
        </pre>
        <Prose>
          A judge whose marks are all identical gives no ranking information, so their z is 0 and
          their scores become the global mean — they neither lift nor sink the projects they saw.
          Where per-judge calibration is too noisy (two or three reviews), organizers can use
          pairwise judging, which needs no calibration at all, and compare the two rankings side by
          side.
        </Prose>
      </DocSection>

      <DocSection title="Honest limits" icon={Scale}>
        <Prose>
          The judging layer — isolation, assignment scoping, deadline enforcement, results secrecy
          and the audit trail — is enforced in the backend and covered by tests. Community voting is
          raised-cost, not attack-proof: that is the honest state of the art for public votes, and
          the organizer chooses how much friction to trade for integrity. The{" "}
          <Link href="/docs/voting" className="text-primary underline underline-offset-4">
            voting-integrity guide
          </Link>{" "}
          walks through exactly why, using the history of one real community.
        </Prose>
      </DocSection>
    </div>
  );
}
