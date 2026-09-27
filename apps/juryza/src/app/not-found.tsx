import Link from "next/link";

import { ArrowLeft, Compass } from "lucide-react";

import { Button } from "@juryza/ui/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-6 py-20">
      <div className="border-border/70 bg-card w-full rounded-2xl border p-8 text-center shadow-sm">
        <div className="bg-primary/10 text-primary mx-auto mb-4 grid size-12 place-items-center rounded-full">
          <Compass className="size-6" />
        </div>
        <p className="text-primary text-sm font-medium uppercase tracking-[0.18em]">Page missing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          This route doesn’t exist yet.
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          The app is fully wired for the core hackathon flow, but this link was stale or incomplete.
          Head back to the main experience.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft className="size-4" /> Home
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/gallery" />}>
            Browse gallery
          </Button>
        </div>
      </div>
    </main>
  );
}
