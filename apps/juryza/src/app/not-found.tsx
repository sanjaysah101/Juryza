import Link from "next/link";

import { ArrowLeft, Compass } from "lucide-react";

import { Button } from "@juryza/ui/components/ui/button";

import { Logo } from "@/components/brand";

/** App-wide 404: a friendly dead end with a way back. */
export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-16 text-center">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <Logo />
      <div className="flex flex-col items-center gap-3">
        <p className="from-primary to-chart-2 bg-linear-to-r bg-clip-text font-mono text-7xl font-semibold tracking-tighter text-transparent sm:text-8xl">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          This page didn't make the shortlist
        </h1>
        <p className="text-muted-foreground max-w-md text-pretty">
          The link may be broken, or the page may have moved. Events that aren't published yet are
          only visible to their organizers.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft /> Back home
        </Button>
        <Button nativeButton={false} render={<Link href="/events" />}>
          <Compass /> Browse events
        </Button>
      </div>
    </div>
  );
}
