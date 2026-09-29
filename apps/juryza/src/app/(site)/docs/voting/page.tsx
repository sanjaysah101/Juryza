import type { Metadata } from "next";
import Link from "next/link";

import { CheckCircle2, Lock, ShieldCheck, Sigma, Users, Vote, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Card, CardContent } from "@juryza/ui/components/ui/card";

import { DocHeader, DocSection, KeyValue, Prose } from "../docs-prose";

export const metadata: Metadata = {
  title: "Voting integrity — Juryza docs",
  description:
    "The real history of a hackathon community's voting, why each fix failed, and how Juryza answers every failure mode.",
};

interface HistoryStep {
  era: string;
  mechanism: string;
  broke: string;
  answer: React.ReactNode;
}

/**
 * The history is drawn from Hackathon Raptors' real evolution of community
 * voting. Each row is a mechanism that was tried, how it was gamed, and the
 * specific Juryza feature that addresses that failure.
 */
const HISTORY: HistoryStep[] = [
  {
    era: "1 · Public social vote",
    mechanism: "Voting ran on LinkedIn reactions.",
    broke:
      "Fake accounts flooded in and votes were openly bought. A reaction count is not an identity.",
    answer: (
      <>
        Juryza never counts an off-platform reaction. Votes are cast against the API under a defined
        access mode; a like on a social post is not a vote and cannot be.
      </>
    ),
  },
  {
    era: "2 · Any channel member",
    mechanism: "Voting moved to Discord; anyone in the channel could vote.",
    broke: "Anyone could join the channel and vote, so it was spammed just as easily.",
    answer: (
      <>
        Access modes gate <em>who</em> can vote: <code>authenticated</code> (accounts only),{" "}
        <code>email</code> (a one-time code, optional domain allowlist), or <code>open</code> (link,
        with per-network caps). The organizer chooses the strength.
      </>
    ),
  },
  {
    era: "3 · Manual “member before kickoff” check",
    mechanism: "Only people who joined before the event started were counted.",
    broke: "Enforced by hand, it did not scale and was still gamed at the edges.",
    answer: (
      <>
        The <strong>electorate lock</strong> automates exactly this rule: set a cutoff and only
        accounts created on or before it can vote. Accounts made during the hackathon are refused by
        the server — no manual list.
      </>
    ),
  },
  {
    era: "4 · Voter role / tag",
    mechanism: "Only members holding a special voting role could vote.",
    broke: "Groups of 50+ organized to acquire the role and brigade a favourite.",
    answer: (
      <>
        A role alone cannot stop coordinated blocs. Juryza raises the cost with{" "}
        <strong>quadratic voting</strong> — piling votes on one project is expensive — plus
        per-voter and per-network rate limits, duplicate keying, and an integrity dashboard that
        surfaces shared networks and burst minutes.
      </>
    ),
  },
  {
    era: "5 · Write-up quest, judges decide",
    mechanism:
      "Open voting was removed; a public write-up challenge on the shortlist, with judges holding final authority.",
    broke:
      "This is where the community landed — and it works because the crowd informs, but does not decide.",
    answer: (
      <>
        Juryza ships this as a first-class mode. <strong>Write-up mode</strong> collects public
        input without a live tally to brigade, and the panel makes the final pick — combinable with
        a <strong>shortlist</strong> so only the top judged projects are ever in play.
      </>
    ),
  },
];

export default function VotingPage() {
  return (
    <div className="flex flex-col gap-10">
      <DocHeader
        eyebrow="Voting integrity"
        title="Community voting is the hard problem"
        lead="Judged scores can be made fair with maths. Community voting cannot — it is an adversarial game against people who want to win. This page tells the real story of how one hackathon community's voting broke, again and again, and maps every failure to a mechanism Juryza enforces in the backend."
      />

      <Alert>
        <ShieldCheck />
        <AlertTitle>The honest premise</AlertTitle>
        <AlertDescription>
          Community voting is <strong>raised-cost, not attack-proof</strong>. That is the state of
          the art for public votes. Juryza&apos;s job is to give organizers the strongest set of
          levers and make abuse visible — not to promise a vote that cannot be gamed.
        </AlertDescription>
      </Alert>

      <DocSection title="A history of breakage" icon={Vote}>
        <Prose>
          Every step below was a genuine attempt to fix the previous one. The pattern is universal:
          any signal cheap to produce gets produced at scale by people with something to gain.
        </Prose>
        <div className="flex flex-col gap-4">
          {HISTORY.map((step, i) => (
            <Card key={step.era}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{step.era}</span>
                  <Badge variant="outline" className="tabular-nums">
                    {i + 1}/{HISTORY.length}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                      <XCircle className="text-destructive size-3.5" /> What happened
                    </span>
                    <p className="text-sm leading-relaxed">
                      {step.mechanism} <span className="text-muted-foreground">{step.broke}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                      <CheckCircle2 className="text-success size-3.5" /> How Juryza answers it
                    </span>
                    <p className="[&_code]:bg-muted [&_code]:text-foreground text-sm leading-relaxed [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
                      {step.answer}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DocSection>

      <DocSection title="The levers, and when to use them" icon={Lock}>
        <Prose>
          An organizer configures voting per event. These compose — a strict event might shortlist
          the top 4, lock the electorate to accounts that existed before kickoff, and run write-up
          mode so judges decide.
        </Prose>
        <KeyValue
          items={[
            {
              term: "Access mode",
              detail:
                "authenticated · email (one-time code + optional domain allowlist) · open (link, capped per network). Start strict; loosen only if you must.",
            },
            {
              term: "Quadratic budget",
              detail:
                "Each voter has a credit budget; v votes on one project cost v². Intensity is expressible, concentration is expensive. Enforced under a per-voter lock so parallel requests can't overspend.",
            },
            {
              term: "Electorate lock",
              detail:
                "Only accounts created on or before a cutoff may vote. Automates the “member before kickoff” rule that once needed a manual list.",
            },
            {
              term: "Shortlist",
              detail:
                "Restrict votes to the top-N projects by judged rank. Mirrors the common practice of polling only the finalists — but enforced by the server.",
            },
            {
              term: "Write-up mode",
              detail:
                "Collect public input with no live tally to brigade; the judging panel holds final authority over the pick. The crowd informs, judges decide.",
            },
            {
              term: "Always on",
              detail:
                "No self-votes, duplicate keying (one row per voter per project), per-IP and per-voter rate limits, and an integrity dashboard (voters by kind, shared networks, burst minutes, full export).",
            },
          ]}
        />
      </DocSection>

      <DocSection title="Why judges, not the crowd, decide the top" icon={Sigma}>
        <Prose>
          The community&apos;s final answer — a write-up quest judged by the panel — is the right
          one, and it generalizes. A public vote is best as a signal (a Community Choice award, a
          tie-breaker among finalists), never as the arbiter of the overall result. Juryza keeps the
          judged pipeline — assignment scoping, cross-judge normalization, deadline enforcement,
          results secrecy — as the source of truth, and treats community voting as a bounded,
          auditable input on top of it. The maths behind the judged result is in the{" "}
          <Link href="/docs/about#judging" className="text-primary underline underline-offset-4">
            project doc
          </Link>
          .
        </Prose>
      </DocSection>

      <Alert>
        <Users />
        <AlertTitle>What still isn&apos;t solved</AlertTitle>
        <AlertDescription>
          Determined Sybils in open mode, distributed IP rotation, and coordination that happens
          entirely off-platform cannot be prevented — only made costlier and visible after the fact.
          When the result must be defensible, prefer authenticated or email-verified voting, an
          electorate lock, a shortlist, and let the judges make the final call.
        </AlertDescription>
      </Alert>
    </div>
  );
}
