import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@juryza/ui/components/ui/card";

import { DOC_LINKS } from "./docs-nav";
import { DocHeader } from "./docs-prose";

export const metadata: Metadata = {
  title: "Documentation — Juryza",
  description:
    "Guides, project background, the voting-integrity design, the roadmap and the live API reference for Juryza.",
};

/** Docs hub: a short intro and a card for every section in `DOC_LINKS`. */
export default function DocsHubPage() {
  const cards = DOC_LINKS.filter((link) => link.href !== "/docs");

  return (
    <div className="flex flex-col gap-8">
      <DocHeader
        eyebrow="Documentation"
        title="Everything you need to run a fair hackathon"
        lead="Juryza is an API-first hackathon judging platform. Start with the tutorial, read why the judging maths is defensible, see how it tackles the community-voting problem, or jump straight into the API."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((link) => (
          <Card key={link.href} className="group hover:ring-primary/40 relative transition-shadow">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <link.icon className="size-4.5" />
                </span>
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {link.eyebrow}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  <Link href={link.href} className="after:absolute after:inset-0">
                    {link.label}
                  </Link>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {link.description}
                </p>
              </div>
              <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-medium">
                Read more
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
