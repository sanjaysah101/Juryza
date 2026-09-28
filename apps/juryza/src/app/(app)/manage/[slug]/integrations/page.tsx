"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Code2,
  FileCode2,
  KeyRound,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@juryza/ui/components/ui/alert-dialog";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import { Checkbox } from "@juryza/ui/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@juryza/ui/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@juryza/ui/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Input } from "@juryza/ui/components/ui/input";
import { Label } from "@juryza/ui/components/ui/label";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { Switch } from "@juryza/ui/components/ui/switch";
import { cn } from "@juryza/ui/lib/utils";

import { CopyButton } from "@/components/copy-button";
import { PageHeader, Section } from "@/components/page";
import { api } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";

/**
 * Integrations: outgoing webhooks (HMAC-signed, per-event subscriptions with a
 * delivery log and test pings), the embeddable project gallery, and pointers to
 * the REST API and personal access tokens.
 */

interface Delivery {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  status: number | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
}
interface Hook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  secretHint: string;
  deliveries: Delivery[];
}
interface HooksData {
  types: string[];
  webhooks: Hook[];
}

const noop = () => () => {};
const useOrigin = () =>
  useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => ""
  );

export default function IntegrationsPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const origin = useOrigin();
  const key = ["webhooks", slug];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api.get<HooksData>(`/api/events/${slug}/webhooks`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Hook | null>(null);

  const toggle = useMutation({
    mutationFn: (h: Hook) => api.patch(`/api/webhooks/${h.id}`, { active: !h.active }),
    onSuccess: (_, h) => {
      toast.success(h.active ? "Webhook paused" : "Webhook active");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: (h: Hook) =>
      api.post<{ status: number | null; ok: boolean; error: string | null }>(
        `/api/webhooks/${h.id}`
      ),
    onSuccess: (res) => {
      if (res.ok) toast.success(`Ping delivered — HTTP ${res.status}`);
      else
        toast.error(res.error ? `Ping failed: ${res.error}` : `Ping failed — HTTP ${res.status}`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (h: Hook) => api.delete(`/api/webhooks/${h.id}`),
    onSuccess: () => {
      toast.success("Webhook deleted");
      setDeleting(null);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const iframeSnippet = `<iframe src="${origin}/embed/${slug}" width="100%" height="640" style="border:0" title="Projects" loading="lazy"></iframe>`;
  const scriptSnippet = `<div data-juryza-event="${slug}"></div>\n<script src="${origin}/embed.js" async></script>`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Webhooks & embed"
        description="Push event activity to your own systems, and put the project gallery on any website."
      />

      <Section
        title="Webhooks"
        description="Juryza POSTs JSON to your URL when things happen. Every request is signed so you can prove it came from here."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Add webhook
          </Button>
        }
      >
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load webhooks</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : !data || data.webhooks.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <WebhookIcon />
              </EmptyMedia>
              <EmptyTitle>No webhooks</EmptyTitle>
              <EmptyDescription>
                Post to Slack, update a CRM, or kick off a pipeline when a project is submitted or
                results go live.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Add webhook
            </Button>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {data.webhooks.map((h) => (
              <Card key={h.id} className="gap-3 py-4">
                <CardContent className="flex flex-col gap-3 px-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Switch
                      checked={h.active}
                      disabled={toggle.isPending && toggle.variables?.id === h.id}
                      onCheckedChange={() => toggle.mutate(h)}
                      aria-label={h.active ? "Pause webhook" : "Activate webhook"}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate font-mono text-sm",
                          !h.active && "text-muted-foreground"
                        )}
                      >
                        {h.url}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Secret {h.secretHint} · added {relativeTime(h.createdAt)}
                        {!h.active && " · paused"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={test.isPending && test.variables?.id === h.id}
                      onClick={() => test.mutate(h)}
                    >
                      {test.isPending && test.variables?.id === h.id ? <Spinner /> : <Send />} Send
                      test
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete webhook ${h.url}`}
                      onClick={() => setDeleting(h)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {h.events.length === 0 ? (
                      <Badge variant="outline">All events</Badge>
                    ) : (
                      h.events.map((t) => (
                        <Badge key={t} variant="secondary" className="font-mono">
                          {t}
                        </Badge>
                      ))
                    )}
                  </div>
                  <Deliveries items={h.deliveries} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <VerifyCard />
      </Section>

      <Section
        title="Embed the gallery"
        description="Show submitted projects on your own site. The script version resizes itself to fit its content."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <Snippet
              title="Script (recommended)"
              code={scriptSnippet}
              hint="Optional attributes: data-theme=&quot;dark&quot;, data-limit=&quot;8&quot;, data-transparent=&quot;1&quot;."
            />
            <Snippet title="Plain iframe" code={iframeSnippet} />
          </div>
          <Card className="gap-0 overflow-hidden py-0">
            <div className="bg-muted/50 text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
              <span>Live preview</span>
              <Link
                href={`/embed/${slug}`}
                target="_blank"
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                Open in new tab
              </Link>
            </div>
            <iframe
              src={`/embed/${slug}`}
              title="Embedded gallery preview"
              className="bg-background h-[480px] w-full border-0"
              loading="lazy"
            />
          </Card>
        </div>
      </Section>

      <Section
        title="REST API"
        description="Everything in the console is an API call — automate any of it."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/docs/api" className="group">
            <Card className="group-hover:bg-muted/40 h-full gap-2 py-4 transition-colors">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCode2 className="size-4" /> API reference
                </CardTitle>
                <CardDescription>
                  OpenAPI 3.1 document and interactive docs for every endpoint.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/settings/tokens" className="group">
            <Card className="group-hover:bg-muted/40 h-full gap-2 py-4 transition-colors">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="size-4" /> Personal access tokens
                </CardTitle>
                <CardDescription>
                  Create a bearer token to call the API from scripts and CI. It acts with your
                  permissions.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </Section>

      {data && (
        <CreateDialog
          slug={slug}
          types={data.types}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={refresh}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Deliveries to <span className="font-mono">{deleting?.url}</span> stop immediately and
              its delivery log is removed. Pause it instead if you may need it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              {remove.isPending && <Spinner />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Snippet({ title, code, hint }: { title: string; code: string; hint?: string }) {
  return (
    <Card className="gap-2 py-3">
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Code2 className="size-4" /> {title}
          </span>
          <CopyButton value={code} />
        </div>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
          {code}
        </pre>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Deliveries({ items }: { items: Delivery[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No deliveries yet — use “Send test” to try it.
      </p>
    );
  }
  const failed = items.filter((d) => !d.ok).length;
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1.5 text-xs font-medium">
        <ChevronRight className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
        Recent deliveries ({items.length}
        {failed > 0 && `, ${failed} failed`})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 flex flex-col divide-y rounded-lg border">
          {items.map((d) => (
            <li key={d.id}>
              <Collapsible>
                <CollapsibleTrigger className="hover:bg-muted/40 group flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
                  <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
                  <Badge
                    className={cn(
                      "w-12 justify-center tabular-nums",
                      d.ok ? "bg-success text-success-foreground" : ""
                    )}
                    variant={d.ok ? "default" : "destructive"}
                  >
                    {d.status ?? "ERR"}
                  </Badge>
                  <code className="min-w-0 flex-1 truncate font-mono text-xs">{d.eventType}</code>
                  <span
                    className="text-muted-foreground shrink-0 text-xs"
                    title={formatDateTime(d.createdAt)}
                  >
                    {relativeTime(d.createdAt)}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-2 px-3 pb-3">
                    {d.error && <p className="text-destructive text-xs">{d.error}</p>}
                    <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-xs">
                      {JSON.stringify(d.payload, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

const VERIFY = `import crypto from "node:crypto";

// rawBody: the exact bytes received — verify before JSON.parse.
function isFromJuryza(rawBody, header, secret) {
  const expected = "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// isFromJuryza(body, req.headers["x-juryza-signature"], process.env.JURYZA_WEBHOOK_SECRET)`;

function VerifyCard() {
  return (
    <Collapsible>
      <Card className="gap-0 py-0">
        <CollapsibleTrigger className="hover:bg-muted/40 group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left">
          <ShieldCheck className="text-muted-foreground size-4" />
          <span className="flex-1 text-sm font-medium">Verifying signatures</span>
          <ChevronRight className="text-muted-foreground size-4 transition-transform group-data-[panel-open]:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 px-4 pb-4">
            <p className="text-muted-foreground text-sm">
              Each request carries <code className="font-mono">X-Juryza-Event</code> and{" "}
              <code className="font-mono">X-Juryza-Signature: sha256=&lt;hex&gt;</code> — an
              HMAC-SHA256 of the raw body using the webhook's secret. Compute it yourself and
              compare in constant time; reject anything that doesn't match.
            </p>
            <div className="relative">
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
                {VERIFY}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton value={VERIFY} />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CreateDialog({
  slug,
  types,
  open,
  onOpenChange,
  onCreated,
}: {
  slug: string;
  types: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const reset = () => {
    setUrl("");
    setEvents([]);
    setSecret(null);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };
  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string; secret: string }>(`/api/events/${slug}/webhooks`, { url, events }),
    onSuccess: (res) => {
      setSecret(res.secret);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{secret ? "Save your signing secret" : "Add a webhook"}</DialogTitle>
          <DialogDescription>
            {secret
              ? "This is the only time the secret is shown. Store it with your receiver — you'll need it to verify signatures."
              : "Juryza will POST a signed JSON body to this URL for each selected event."}
          </DialogDescription>
        </DialogHeader>
        {secret ? (
          <div className="flex flex-col gap-3">
            <div className="bg-muted flex items-center gap-2 rounded-lg border p-2">
              <code className="min-w-0 flex-1 truncate px-1 font-mono text-xs">{secret}</code>
              <CopyButton value={secret} />
            </div>
            <Alert>
              <KeyRound />
              <AlertDescription>
                Lost it? Delete the webhook and create a new one — secrets can't be retrieved later.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <form
            id="webhook-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hook-url">Payload URL</Label>
              <Input
                id="hook-url"
                type="url"
                required
                autoFocus
                placeholder="https://example.com/hooks/juryza"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
                Events
                <span className="text-muted-foreground text-xs font-normal">
                  {events.length === 0 ? "None selected = all events" : `${events.length} selected`}
                </span>
              </legend>
              <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {types.map((t) => (
                  <Label
                    key={t}
                    className="hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-normal"
                  >
                    <Checkbox
                      checked={events.includes(t)}
                      onCheckedChange={(on) =>
                        setEvents(on ? [...events, t] : events.filter((x) => x !== t))
                      }
                    />
                    <span className="font-mono text-xs">{t}</span>
                  </Label>
                ))}
              </div>
            </fieldset>
          </form>
        )}
        <DialogFooter>
          {secret ? (
            <Button onClick={close}>I've saved it</Button>
          ) : (
            <Button type="submit" form="webhook-form" disabled={!url || create.isPending}>
              {create.isPending ? <Spinner /> : <Plus />} Create webhook
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
