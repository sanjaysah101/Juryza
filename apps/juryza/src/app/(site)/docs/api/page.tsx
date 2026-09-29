"use client";

import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  FileJson,
  Gauge,
  Globe,
  KeyRound,
  ListTree,
  Lock,
  LockOpen,
  Search,
  ServerCog,
  TriangleAlert,
  Webhook,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@juryza/ui/components/ui/input-group";
import { Kbd } from "@juryza/ui/components/ui/kbd";
import { Separator } from "@juryza/ui/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@juryza/ui/components/ui/sheet";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";
import { cn } from "@juryza/ui/lib/utils";

import { CopyButton } from "@/components/copy-button";
import { api } from "@/lib/api";

/**
 * API reference — renders the live OpenAPI document (`/api/openapi.json`):
 * a searchable operation index, then per operation its method, path, access
 * rule, parameters, request body fields, responses and a ready-to-run curl.
 */

/* ───────────────────────────── OpenAPI shapes ───────────────────────────── */

interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  additionalProperties?: Schema | boolean;
}

interface Parameter {
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: Schema;
}

interface ResponseObject {
  description: string;
  $ref?: string;
  content?: Record<string, { schema?: Schema }>;
}

interface Operation {
  operationId: string;
  tags: string[];
  summary: string;
  description?: string;
  security?: Record<string, string[]>[];
  parameters?: Parameter[];
  requestBody?: { content: Record<string, { schema: Schema }> };
  responses: Record<string, ResponseObject>;
}

interface WebhookItem {
  post: { summary: string; requestBody: { content: { "application/json": { schema: Schema } } } };
}

interface OpenApiDoc {
  info: { title: string; version: string };
  tags: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<Method, Operation>>>;
  webhooks?: Record<string, WebhookItem>;
  components: { responses: Record<string, ResponseObject> };
}

type Method = "get" | "post" | "put" | "patch" | "delete";
const METHODS: Method[] = ["get", "post", "put", "patch", "delete"];

interface Entry {
  method: Method;
  path: string;
  op: Operation;
  anchor: string;
}

/* ───────────────────────────── Schema helpers ───────────────────────────── */

function unwrap(s: Schema): { schema: Schema; nullable: boolean } {
  if (Array.isArray(s.type) && s.type.includes("null")) {
    const rest = s.type.filter((t) => t !== "null");
    return { schema: { ...s, type: rest.length === 1 ? rest[0] : rest }, nullable: true };
  }
  if (s.anyOf?.some((x) => x.type === "null")) {
    const rest = s.anyOf.filter((x) => x.type !== "null");
    const inner = rest.length === 1 && rest[0] ? rest[0] : { ...s, anyOf: rest };
    return {
      schema: { ...inner, description: s.description ?? inner.description },
      nullable: true,
    };
  }
  return { schema: s, nullable: false };
}

function typeLabel(input: Schema): string {
  const { schema: s, nullable } = unwrap(input);
  let label: string;
  if (s.const !== undefined) label = JSON.stringify(s.const);
  else if (s.enum) label = s.enum.map((v) => JSON.stringify(v)).join(" | ");
  else if (s.anyOf) label = [...new Set(s.anyOf.map(typeLabel))].join(" | ");
  else if (Array.isArray(s.type)) label = s.type.join(" | ");
  else if (s.type === "array") {
    const inner = s.items ? typeLabel(s.items) : "any";
    label = inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
  } else if (s.type === "object" && !s.properties && typeof s.additionalProperties === "object") {
    label = `Record<string, ${typeLabel(s.additionalProperties)}>`;
  } else if (s.type === "string" && s.format) label = s.format;
  else label = s.type ?? "any";
  return nullable ? `${label} | null` : label;
}

function constraints(input: Schema): string[] {
  const { schema: s } = unwrap(input);
  const out: string[] = [];
  const range = (lo: number | undefined, hi: number | undefined, unit: string) => {
    if (lo !== undefined && hi !== undefined) out.push(`${lo}–${hi}${unit}`);
    else if (lo !== undefined) out.push(`≥ ${lo}${unit}`);
    else if (hi !== undefined) out.push(`≤ ${hi}${unit}`);
  };
  range(s.minLength, s.maxLength, " chars");
  range(s.minimum, s.maximum, "");
  range(s.minItems, s.maxItems, " items");
  if (s.pattern) out.push(`matches ${s.pattern}`);
  if (s.default !== undefined) out.push(`default ${JSON.stringify(s.default)}`);
  return out;
}

interface Field {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  constraints: string[];
  depth: number;
}

function flatten(schema: Schema, prefix = "", depth = 0, out: Field[] = []): Field[] {
  const required = new Set(schema.required ?? []);
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const { schema: inner } = unwrap(prop);
    out.push({
      name: `${prefix}${key}`,
      type: typeLabel(prop),
      required: required.has(key),
      description: prop.description ?? inner.description,
      constraints: constraints(prop),
      depth,
    });
    if (inner.type === "object" && inner.properties)
      flatten(inner, `${prefix}${key}.`, depth + 1, out);
    const items = inner.type === "array" && inner.items ? unwrap(inner.items).schema : null;
    if (items?.type === "object" && items.properties)
      flatten(items, `${prefix}${key}[].`, depth + 1, out);
  }
  return out;
}

const SAMPLE_STRINGS: Record<string, string> = {
  email: "you@example.com",
  password: "a-long-passphrase",
  name: "Night Owls",
  title: "Issue Radar",
  slug: "my-hackathon-2026",
  key: "impact",
  label: "CI token",
  code: "123456",
  username: "ada",
  token: "INVITE_TOKEN",
  projectId: "PROJECT_ID",
  winnerId: "PROJECT_A",
  loserId: "PROJECT_B",
  body: "Great demo!",
};

function sample(input: Schema, key?: string): unknown {
  const { schema: s } = unwrap(input);
  if (s.default !== undefined) return s.default;
  if (s.const !== undefined) return s.const;
  if (s.enum?.length) return s.enum[0];
  if (s.anyOf?.[0]) return sample(s.anyOf[0], key);
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case "object": {
      if (!s.properties && typeof s.additionalProperties === "object") {
        return { impact: sample(s.additionalProperties) };
      }
      const props = Object.entries(s.properties ?? {});
      const req = new Set(s.required ?? []);
      const picked = req.size ? props.filter(([k]) => req.has(k)) : props.slice(0, 2);
      return Object.fromEntries(picked.map(([k, v]) => [k, sample(v, k)]));
    }
    case "array":
      return s.items ? [sample(s.items, key)] : [];
    case "integer":
    case "number":
      return Math.min(s.maximum ?? 4, Math.max(s.minimum ?? 1, 1));
    case "boolean":
      return true;
    case "string":
      if (s.format === "email") return "you@example.com";
      if (s.format === "date-time") return "2026-10-01T17:00:00Z";
      if (s.format === "uri") return "https://example.com";
      return (key && SAMPLE_STRINGS[key]) ?? key ?? "string";
    default:
      return null;
  }
}

/* ───────────────────────────── Operation helpers ───────────────────────────── */

type Access = "public" | "optional" | "user";

function accessOf(op: Operation): Access {
  const sec = op.security ?? [];
  if (sec.length === 0) return "public";
  return sec.some((s) => Object.keys(s).length === 0) ? "optional" : "user";
}

function resolve(doc: OpenApiDoc, r: ResponseObject): ResponseObject {
  const name = r.$ref?.split("/").pop();
  return (name && doc.components.responses[name]) || r;
}

const EXAMPLE_PARAMS: Record<string, string> = { event: "sample-hack-2026" };

function curlFor(e: Entry): string {
  const path = e.path.replace(
    /\{(\w+)\}/g,
    (_m, name: string) => EXAMPLE_PARAMS[name] ?? `{${name}}`
  );
  const query = (e.op.parameters ?? [])
    .filter((p) => p.in === "query" && p.required)
    .map((p) => `${p.name}=${p.name.toUpperCase()}`)
    .join("&");
  const lines = [
    `curl -X ${e.method.toUpperCase()} "$JURYZA_URL${path}${query ? `?${query}` : ""}"`,
  ];
  if (accessOf(e.op) !== "public") lines.push(`-H "Authorization: Bearer $JURYZA_TOKEN"`);
  const schema = e.op.requestBody?.content["application/json"]?.schema;
  if (schema) {
    lines.push(`-H "Content-Type: application/json"`);
    lines.push(`-d '${JSON.stringify(sample(schema), null, 2)}'`);
  }
  return lines.join(" \\\n  ");
}

function haystack(e: Entry) {
  return `${e.method} ${e.path} ${e.op.summary} ${e.op.tags.join(" ")} ${e.op.description ?? ""}`.toLowerCase();
}

/* ───────────────────────────── Small components ───────────────────────────── */

const METHOD_STYLE: Record<Method, string> = {
  get: "bg-chart-5/12 text-chart-5 border-chart-5/25",
  post: "bg-success/12 text-success border-success/25",
  put: "bg-warning text-warning-foreground border-warning",
  patch: "bg-primary/10 text-primary border-primary/25",
  delete: "bg-destructive/10 text-destructive border-destructive/25",
};

function MethodBadge({ method, compact }: { method: Method; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-mono font-semibold tracking-wide uppercase",
        compact ? "h-4.5 w-12 text-[0.625rem]" : "h-6 px-2 text-xs",
        METHOD_STYLE[method]
      )}
    >
      {method === "delete" && compact ? "DEL" : method}
    </span>
  );
}

/** Split `text` on a capturing pattern, keyed by character offset. */
function tokens(text: string, pattern: RegExp): { at: number; part: string }[] {
  let at = 0;
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => {
      const token = { at, part };
      at += part.length;
      return token;
    });
}

function PathText({ path, className }: { path: string; className?: string }) {
  return (
    <code className={cn("font-mono break-all", className)}>
      {tokens(path, /(\{\w+\})/).map(({ at, part }) =>
        part.startsWith("{") ? (
          <span key={at} className="text-primary">
            {part}
          </span>
        ) : (
          <span key={at}>{part}</span>
        )
      )}
    </code>
  );
}

/** Inline Markdown: `code` and **bold** — all the spec's descriptions use. */
function Prose({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <p className={cn("text-muted-foreground text-sm leading-relaxed text-pretty", className)}>
      {tokens(text, /(`[^`]+`|\*\*[^*]+\*\*)/).map(({ at, part }) => {
        if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={at}
              className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.8em]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={at} className="text-foreground font-medium">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={at}>{part}</span>;
      })}
    </p>
  );
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="bg-muted/60 relative min-w-0 rounded-lg border">
      <div className="text-muted-foreground flex items-center justify-between border-b py-1 pr-1 pl-3 text-xs font-medium">
        {label}
        <CopyButton value={code} label={`Copy ${label}`} iconOnly />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const ACCESS: Record<Access, { label: string; icon: typeof Lock; hint: string }> = {
  public: { label: "Public", icon: Globe, hint: "No credential needed." },
  optional: {
    label: "Auth optional",
    icon: LockOpen,
    hint: "Works signed out; a credential unlocks more.",
  },
  user: {
    label: "Auth required",
    icon: Lock,
    hint: "Bearer token or session cookie; 401 without one.",
  },
};

function AccessBadge({ access }: { access: Access }) {
  const { label, icon: Icon, hint } = ACCESS[access];
  return (
    <Badge variant={access === "user" ? "secondary" : "outline"} title={hint}>
      <Icon /> {label}
    </Badge>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-foreground text-xs font-semibold tracking-wide uppercase">{children}</h4>
  );
}

function FieldList({ schema }: { schema: Schema }) {
  const fields = flatten(schema);
  if (fields.length === 0) return <p className="text-muted-foreground text-sm">Any JSON object.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {fields.map((f) => (
        <li
          key={f.name}
          className="flex flex-col gap-1 px-3 py-2.5"
          style={{ paddingLeft: `${0.75 + f.depth * 1.25}rem` }}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <code className="text-foreground font-mono text-sm font-medium">{f.name}</code>
            <code className="text-muted-foreground font-mono text-xs break-all">{f.type}</code>
            {f.required ? (
              <span className="text-destructive text-xs font-medium">required</span>
            ) : (
              <span className="text-muted-foreground text-xs">optional</span>
            )}
          </div>
          {f.description && <Prose text={f.description} className="text-xs" />}
          {f.constraints.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {f.constraints.map((c) => (
                <span
                  key={c}
                  className="bg-muted text-muted-foreground max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[0.7rem]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ParamsTable({ params }: { params: Parameter[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>In</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="min-w-64">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.map((p) => (
            <TableRow key={`${p.in}:${p.name}`}>
              <TableCell className="align-top">
                <code className="font-mono text-sm font-medium">{p.name}</code>
                {p.required && <span className="text-destructive ml-1.5 text-xs">required</span>}
              </TableCell>
              <TableCell className="text-muted-foreground align-top text-xs">{p.in}</TableCell>
              <TableCell className="align-top">
                <code className="text-muted-foreground font-mono text-xs">
                  {p.schema ? typeLabel(p.schema) : "string"}
                </code>
              </TableCell>
              <TableCell className="align-top whitespace-normal">
                <Prose text={p.description} className="text-xs" />
                {p.schema?.default !== undefined && (
                  <span className="text-muted-foreground font-mono text-[0.7rem]">
                    default {JSON.stringify(p.schema.default)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function statusTone(code: string) {
  if (code.startsWith("2")) return "bg-success/12 text-success";
  if (code === "429" || code === "409") return "bg-warning text-warning-foreground";
  if (code.startsWith("4")) return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function Responses({
  doc,
  responses,
}: {
  doc: OpenApiDoc;
  responses: Record<string, ResponseObject>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {Object.entries(responses).map(([code, r]) => {
        const res = resolve(doc, r);
        const types = Object.keys(res.content ?? {});
        return (
          <li key={code} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex h-5 w-10 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold",
                statusTone(code)
              )}
            >
              {code}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Prose text={res.description} className="text-foreground" />
              {code.startsWith("2") && types.length > 0 && (
                <span className="text-muted-foreground font-mono text-[0.7rem]">
                  {types.join(", ")}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OperationCard({ doc, entry }: { doc: OpenApiDoc; entry: Entry }) {
  const { op, method, path } = entry;
  const schema = op.requestBody?.content["application/json"]?.schema;
  const params = op.parameters ?? [];
  return (
    <Card id={entry.anchor} data-op={entry.anchor} className="scroll-mt-24 gap-5">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={method} />
          <PathText path={path} className="text-sm font-medium" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">
            <a href={`#${entry.anchor}`} className="hover:underline underline-offset-4">
              {op.summary}
            </a>
          </CardTitle>
          <AccessBadge access={accessOf(op)} />
        </div>
        <Prose text={op.description} />
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          {params.length > 0 && (
            <section className="flex flex-col gap-2">
              <SubHeading>Parameters</SubHeading>
              <ParamsTable params={params} />
            </section>
          )}
          {schema && (
            <section className="flex flex-col gap-2">
              <SubHeading>Request body</SubHeading>
              <FieldList schema={schema} />
            </section>
          )}
          <section className="flex flex-col gap-2">
            <SubHeading>Responses</SubHeading>
            <Responses doc={doc} responses={op.responses} />
          </section>
        </div>
        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <CodeBlock code={curlFor(entry)} label="curl" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Navigation ───────────────────────────── */

interface Group {
  tag: string;
  description?: string;
  entries: Entry[];
}

const tagAnchor = (tag: string) => `tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function SectionLink({
  id,
  label,
  onNavigate,
}: {
  id: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={`#${id}`}
      onClick={onNavigate}
      className="text-muted-foreground hover:text-foreground font-medium"
    >
      {label}
    </a>
  );
}

function OperationNav({
  groups,
  active,
  onNavigate,
}: {
  groups: Group[];
  active: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="API operations" className="flex flex-col gap-5 text-sm">
      <SectionLink id="introduction" label="Introduction" onNavigate={onNavigate} />
      {groups.map((g) => (
        <div key={g.tag} className="flex flex-col gap-1">
          <a
            href={`#${tagAnchor(g.tag)}`}
            onClick={onNavigate}
            className="text-foreground text-xs font-semibold tracking-wide uppercase hover:underline"
          >
            {g.tag}
          </a>
          <ul className="flex flex-col">
            {g.entries.map((e) => (
              <li key={e.anchor}>
                <a
                  href={`#${e.anchor}`}
                  onClick={onNavigate}
                  aria-current={active === e.anchor ? "location" : undefined}
                  className={cn(
                    "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                    active === e.anchor ? "bg-muted text-foreground" : "text-muted-foreground"
                  )}
                >
                  <MethodBadge method={e.method} compact />
                  <span className="truncate">{e.op.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <SectionLink id="webhooks" label="Webhook payloads" onNavigate={onNavigate} />
    </nav>
  );
}

/* ───────────────────────────── Intro & webhooks ───────────────────────────── */

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// rawBody: the exact bytes received — verify before JSON.parse.
function verify(rawBody, header, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}`;

const ERROR_SNIPPET = `HTTP/1.1 400 Bad Request
{
  "error": "Give your project a title",
  "issues": [{ "path": ["title"], "code": "too_small", "message": "Give your project a title" }]
}

HTTP/1.1 429 Too Many Requests
{ "error": "Too many requests, slow down", "retryAfterSeconds": 42 }`;

function IntroCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lock;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground flex min-w-0 flex-col gap-3 text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

function Intro({ origin, count }: { origin: string; count: number }) {
  const setup = `export JURYZA_URL="${origin}"
export JURYZA_TOKEN="jz_…"   # from /settings/tokens

curl "$JURYZA_URL/api/me" -H "Authorization: Bearer $JURYZA_TOKEN"`;
  return (
    <section id="introduction" className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            ← Docs
          </Link>
          <Badge variant="outline" className="h-6">
            <ServerCog /> REST · OpenAPI 3.1 · {count} operations
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          API reference
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base text-pretty">
          Every screen in Juryza is built on this API — anything you can click, a script can do.
          Authorization is enforced by the server on every call, so each operation below states
          exactly who may call it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/settings/tokens" />}>
            <KeyRound /> Create a token
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/api/openapi.json" target="_blank" rel="noreferrer" />}
          >
            <FileJson /> Raw OpenAPI spec
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntroCard icon={KeyRound} title="Authentication">
          <p>
            Create a personal token at{" "}
            <Link
              href="/settings/tokens"
              className="text-primary underline-offset-4 hover:underline"
            >
              /settings/tokens
            </Link>{" "}
            and send it as{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              Authorization: Bearer jz_…
            </code>
            . It acts with your role; the secret is shown once and stored only as a hash. Browsers
            use the session cookie instead.
          </p>
          <CodeBlock code={setup} label="Quick start" />
        </IntroCard>
        <IntroCard icon={AlertCircle} title="Base URL & errors">
          <p>
            All paths are relative to your instance —{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              {origin}
            </code>
            . Bodies are JSON. Failures return{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              {"{ error, issues? }"}
            </code>{" "}
            with the HTTP status; validation errors (400) list each offending field in{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">issues</code>.
          </p>
          <CodeBlock code={ERROR_SNIPPET} label="Error responses" />
        </IntroCard>
        <IntroCard icon={Gauge} title="Rate limits">
          <p>
            Abuse-prone actions are limited: votes (60/min per network, 30/min per voter), comments
            (10/min), voter email codes and sign-in attempts. Over the limit you get{" "}
            <strong className="text-foreground font-medium">429</strong> with{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              retryAfterSeconds
            </code>{" "}
            — wait that long, then retry.
          </p>
        </IntroCard>
        <IntroCard icon={Webhook} title="Webhooks & signatures">
          <p>
            Organizers subscribe per event with{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              POST /api/events/{"{event}"}/webhooks
            </code>
            . Each delivery is a POST of{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              {"{ type, sentAt, data }"}
            </code>{" "}
            signed in{" "}
            <code className="bg-muted text-foreground rounded px-1 font-mono text-xs">
              X-Juryza-Signature: sha256=…
            </code>
            , an HMAC-SHA256 of the raw body keyed with your subscription secret.
          </p>
          <CodeBlock code={VERIFY_SNIPPET} label="Verify a delivery (Node)" />
        </IntroCard>
      </div>
    </section>
  );
}

function WebhookPayloads({ doc }: { doc: OpenApiDoc }) {
  const items = Object.entries(doc.webhooks ?? {});
  if (items.length === 0) return null;
  return (
    <section id="webhooks" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Webhook payloads</h2>
        <p className="text-muted-foreground text-sm">
          Every delivery&apos;s{" "}
          <code className="bg-muted rounded px-1 font-mono text-xs">data</code> carries{" "}
          <code className="bg-muted rounded px-1 font-mono text-xs">eventId</code> plus the fields
          below. The type is also sent in{" "}
          <code className="bg-muted rounded px-1 font-mono text-xs">X-Juryza-Event</code>.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>When</TableHead>
              <TableHead>data fields</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(([type, item]) => {
              const data =
                item.post.requestBody.content["application/json"].schema.properties?.data;
              const fields = Object.entries(data?.properties ?? {}).filter(
                ([k]) => k !== "eventId"
              );
              return (
                <TableRow key={type}>
                  <TableCell>
                    <code className="font-mono text-sm font-medium">{type}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.post.summary}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {fields.map(([k, v]) => (
                        <span key={k} className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                          {k}: <span className="text-muted-foreground">{typeLabel(v)}</span>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

function useOrigin() {
  const [origin, setOrigin] = useState("https://juryza.example.com");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function DocsSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="hidden flex-col gap-2 lg:flex">
        {Array.from({ length: 14 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export default function ApiReferencePage() {
  const {
    data: doc,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["openapi"],
    queryFn: () => api.get<OpenApiDoc>("/api/openapi.json"),
    staleTime: 5 * 60_000,
  });
  const origin = useOrigin();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const desktopSearch = useRef<HTMLInputElement>(null);
  const mobileSearch = useRef<HTMLInputElement>(null);

  const all = useMemo<Entry[]>(() => {
    if (!doc) return [];
    return Object.entries(doc.paths).flatMap(([path, item]) =>
      METHODS.flatMap((method) => {
        const op = item[method];
        return op ? [{ method, path, op, anchor: `op-${op.operationId}` }] : [];
      })
    );
  }, [doc]);

  const groups = useMemo<Group[]>(() => {
    if (!doc) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matching = all.filter((e) => terms.every((t) => haystack(e).includes(t)));
    return doc.tags
      .map((t) => ({
        tag: t.name,
        description: t.description,
        entries: matching.filter((e) => e.op.tags.includes(t.name)),
      }))
      .filter((g) => g.entries.length > 0);
  }, [doc, all, query]);

  const visibleKey = groups.flatMap((g) => g.entries.map((e) => e.anchor)).join(",");
  useEffect(() => {
    if (!visibleKey) return;
    const observer = new IntersectionObserver(
      (records) => {
        const hit = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.getAttribute("data-op"));
      },
      { rootMargin: "-96px 0px -65% 0px" }
    );
    for (const el of document.querySelectorAll("[data-op]")) observer.observe(el);
    return () => observer.disconnect();
  }, [visibleKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      const input = [desktopSearch.current, mobileSearch.current].find(
        (el) => el && el.offsetParent !== null
      );
      input?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = groups.reduce((n, g) => n + g.entries.length, 0);

  const search = (ref: RefObject<HTMLInputElement | null>) => (
    <InputGroup className="bg-background">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search endpoints"
        aria-label="Search endpoints"
      />
      <InputGroupAddon align="inline-end">
        {query ? <span className="text-xs tabular-nums">{matches}</span> : <Kbd>/</Kbd>}
      </InputGroupAddon>
    </InputGroup>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      {isLoading ? (
        <DocsSkeleton />
      ) : error || !doc ? (
        <Alert variant="destructive" className="max-w-xl">
          <TriangleAlert />
          <AlertTitle>Could not load the API description</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {error instanceof Error ? error.message : "The OpenAPI document is unavailable."}
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 flex max-h-[calc(100svh-7rem)] flex-col gap-4">
              {search(desktopSearch)}
              <div className="-mr-2 overflow-y-auto pr-2 pb-6">
                <OperationNav groups={groups} active={active} />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-12">
            <div className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-16 z-30 -mx-4 flex gap-2 border-b px-4 py-3 backdrop-blur lg:hidden">
              <div className="min-w-0 flex-1">{search(mobileSearch)}</div>
              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetTrigger render={<Button variant="outline" />}>
                  <ListTree /> Endpoints
                </SheetTrigger>
                <SheetContent side="left" className="w-80 gap-0">
                  <SheetHeader>
                    <SheetTitle>Endpoints</SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto px-4 pb-6">
                    <OperationNav
                      groups={groups}
                      active={active}
                      onNavigate={() => setNavOpen(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <Intro origin={origin} count={all.length} />

            {groups.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search />
                  </EmptyMedia>
                  <EmptyTitle>No endpoints match “{query}”</EmptyTitle>
                  <EmptyDescription>
                    Try a path fragment like “votes”, a method like “delete”, or a tag like
                    “judging”.
                  </EmptyDescription>
                </EmptyHeader>
                <Button variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </Empty>
            ) : (
              groups.map((g) => (
                <section
                  key={g.tag}
                  id={tagAnchor(g.tag)}
                  className="flex scroll-mt-24 flex-col gap-4"
                >
                  <div className="flex flex-col gap-1 border-b pb-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight">
                        <a
                          href={`#${tagAnchor(g.tag)}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {g.tag}
                        </a>
                      </h2>
                      <Badge variant="outline" className="tabular-nums">
                        {g.entries.length}
                      </Badge>
                    </div>
                    {g.description && (
                      <p className="text-muted-foreground text-sm">{g.description}</p>
                    )}
                  </div>
                  {g.entries.map((e) => (
                    <OperationCard key={e.anchor} doc={doc} entry={e} />
                  ))}
                </section>
              ))
            )}

            <Separator />
            <WebhookPayloads doc={doc} />
          </div>
        </div>
      )}
    </div>
  );
}
