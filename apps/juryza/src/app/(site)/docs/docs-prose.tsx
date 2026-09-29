import type { LucideIcon } from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { cn } from "@juryza/ui/lib/utils";

/**
 * Presentational primitives shared by the written docs pages (guide, about,
 * roadmap, voting). Kept here so every article reads with the same rhythm and
 * uses semantic tokens rather than ad-hoc classes.
 */

export function DocHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b pb-6">
      {eyebrow && (
        <span className="text-primary text-xs font-semibold tracking-wide uppercase">
          {eyebrow}
        </span>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {lead && (
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty">
          {lead}
        </p>
      )}
    </header>
  );
}

export function DocSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id?: string;
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        {Icon && (
          <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        )}
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-sm leading-relaxed text-pretty", className)}>
      {children}
    </p>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-4">{children}</ol>;
}

export function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
        {index}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-foreground font-medium">{title}</h3>
        <div className="text-muted-foreground text-sm leading-relaxed text-pretty">{children}</div>
      </div>
    </li>
  );
}

export function KeyValue({ items }: { items: { term: string; detail: React.ReactNode }[] }) {
  return (
    <dl className="divide-y rounded-lg border">
      {items.map((item) => (
        <div key={item.term} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-foreground text-sm font-medium">{item.term}</dt>
          <dd className="text-muted-foreground text-sm leading-relaxed">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "success" | "warning";
}) {
  const variant = tone === "muted" ? "outline" : "secondary";
  return (
    <Badge
      variant={variant}
      className={cn(
        tone === "primary" && "bg-primary/10 text-primary border-primary/20",
        tone === "success" && "bg-success/12 text-success border-success/25",
        tone === "warning" && "bg-warning text-warning-foreground border-warning"
      )}
    >
      {children}
    </Badge>
  );
}
