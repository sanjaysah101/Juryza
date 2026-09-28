"use client";

/**
 * /manage/<slug>/tracks — tracks & prizes. Two list editors, each saved as a
 * whole: PUT /api/events/:slug/tracks (existing rows keep their id so projects
 * keep their track) and PUT /api/events/:slug/prizes.
 */

import { useState } from "react";
import { useParams } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Save, Tags, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Input } from "@juryza/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@juryza/ui/components/ui/select";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { Textarea } from "@juryza/ui/components/ui/textarea";
import { cn } from "@juryza/ui/lib/utils";

import { api } from "@/lib/api";
import { type EventDetail, eventKey, useEvent } from "@/lib/queries";
import type { Json, Prize, Track } from "@/lib/types";

interface TrackRow {
  key: string;
  id?: string;
  name: string;
  description: string;
}
type Kind = "overall" | "track" | "community";
interface PrizeRow {
  key: string;
  kind: Kind;
  trackId: string | null;
  name: string;
  amount: string;
  rank: number;
  description: string;
}

let seq = 0;
const newKey = () => `new-${++seq}`;

const toTrackRows = (tracks: Json<Track>[]): TrackRow[] =>
  tracks.map((t) => ({ key: t.id, id: t.id, name: t.name, description: t.description ?? "" }));
const toPrizeRows = (prizes: Json<Prize>[]): PrizeRow[] =>
  prizes.map((p) => ({
    key: p.id,
    kind: p.kind as Kind,
    trackId: p.trackId,
    name: p.name,
    amount: p.amount ?? "",
    rank: p.rank,
    description: p.description ?? "",
  }));

const strip = <T extends { key: string }>(rows: T[]) =>
  JSON.stringify(rows.map(({ key: _k, ...r }) => r));

export default function TracksPrizesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useEvent(slug);
  if (!data) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <TracksEditor key={`t-${data.event.id}`} slug={slug} tracks={data.tracks} />
      <PrizesEditor key={`p-${data.event.id}`} slug={slug} detail={data} />
    </div>
  );
}

function TracksEditor({ slug, tracks }: { slug: string; tracks: Json<Track>[] }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(() => toTrackRows(tracks));
  const [rows, setRows] = useState(saved);
  const dirty = strip(rows) !== strip(saved);
  const invalid = rows.some((r) => !r.name.trim());

  const save = useMutation({
    mutationFn: () =>
      api.put<{ tracks: Json<Track>[] }>(`/api/events/${slug}/tracks`, {
        tracks: rows.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          description: r.description.trim() || null,
        })),
      }),
    onSuccess: async (res) => {
      const fresh = toTrackRows(res.tracks);
      setSaved(fresh);
      setRows(fresh);
      toast.success("Tracks saved");
      await queryClient.invalidateQueries({ queryKey: eventKey(slug) });
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, patch: Partial<TrackRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(i, 1);
      if (row) next.splice(i + by, 0, row);
      return next;
    });
  const removed = saved.filter((s) => !rows.some((r) => r.id === s.id)).length;

  return (
    <Card className={cn(dirty && "ring-primary/40 ring-2")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="size-4" /> Tracks
          {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
        </CardTitle>
        <CardDescription>
          The categories projects compete in. Order here is the order participants see.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length >= 30}
            onClick={() => setRows((rs) => [...rs, { key: newKey(), name: "", description: "" }])}
          >
            <Plus /> Add track
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ol className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className="bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
              >
                <span className="text-muted-foreground bg-muted grid size-8 shrink-0 place-items-center rounded-md text-xs font-medium tabular-nums">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                  <Input
                    value={r.name}
                    maxLength={60}
                    placeholder="Track name"
                    aria-label={`Track ${i + 1} name`}
                    aria-invalid={!r.name.trim()}
                    autoFocus={!r.id && i === rows.length - 1}
                    onChange={(e) => update(r.key, { name: e.target.value })}
                  />
                  <Input
                    value={r.description}
                    maxLength={400}
                    placeholder="Short description (optional)"
                    aria-label={`Track ${i + 1} description`}
                    onChange={(e) => update(r.key, { description: e.target.value })}
                  />
                </div>
                <div className="flex shrink-0 gap-1 self-end sm:self-start">
                  {!r.id && (
                    <Badge variant="outline" className="mt-1.5 mr-1">
                      New
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.name || "track"}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Tags />
              </EmptyMedia>
              <EmptyTitle>No tracks</EmptyTitle>
              <EmptyDescription>
                Every project competes in a single pool. Add tracks to judge and award by category.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => setRows([{ key: newKey(), name: "", description: "" }])}
              >
                <Plus /> Add the first track
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t">
        <p className="text-muted-foreground text-sm">
          {removed > 0
            ? `${removed} removed — their projects become untracked.`
            : dirty
              ? "You have unsaved changes."
              : "All changes saved."}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setRows(saved)} disabled={save.isPending}>
              Discard
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={!dirty || invalid || save.isPending}>
            {save.isPending ? <Spinner /> : <Save />} Save tracks
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

const KIND_LABEL: Record<Kind, string> = {
  overall: "Overall",
  track: "Track",
  community: "Community",
};

function PrizesEditor({ slug, detail }: { slug: string; detail: EventDetail }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(() => toPrizeRows(detail.prizes));
  const [rows, setRows] = useState(saved);
  const dirty = strip(rows) !== strip(saved);
  const invalid = rows.some(
    (r) => !r.name.trim() || (r.kind === "track" && !r.trackId) || !(r.rank >= 1 && r.rank <= 50)
  );
  const trackItems = Object.fromEntries(detail.tracks.map((t) => [t.id, t.name]));

  const save = useMutation({
    mutationFn: () =>
      api.put<{ prizes: Json<Prize>[] }>(`/api/events/${slug}/prizes`, {
        prizes: rows.map((r) => ({
          kind: r.kind,
          trackId: r.kind === "track" ? r.trackId : null,
          name: r.name.trim(),
          amount: r.amount.trim() || null,
          rank: r.rank,
          description: r.description.trim() || null,
        })),
      }),
    onSuccess: async (res) => {
      const fresh = toPrizeRows(res.prizes);
      setSaved(fresh);
      setRows(fresh);
      toast.success("Prizes saved");
      await queryClient.invalidateQueries({ queryKey: eventKey(slug) });
    },
    onError: (e) => toast.error(e.message),
  });

  const update = (key: string, patch: Partial<PrizeRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((rs) => [
      ...rs,
      {
        key: newKey(),
        kind: "overall",
        trackId: null,
        name: "",
        amount: "",
        rank: rs.filter((r) => r.kind === "overall").length + 1,
        description: "",
      },
    ]);

  return (
    <Card className={cn(dirty && "ring-primary/40 ring-2")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4" /> Prizes
          {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
        </CardTitle>
        <CardDescription>
          Awarded by overall judged rank, by rank within a track, or by the community vote. Winners
          are computed from the results.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={add} disabled={rows.length >= 40}>
            <Plus /> Add prize
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={r.key} className="grid gap-3 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[9rem_12rem_minmax(0,1fr)_8rem_5rem_auto]">
                  <Select
                    value={r.kind}
                    items={KIND_LABEL}
                    onValueChange={(v) =>
                      v &&
                      update(r.key, {
                        kind: v as Kind,
                        trackId: v === "track" ? (r.trackId ?? detail.tracks[0]?.id ?? null) : null,
                      })
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Prize kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                        <SelectItem
                          key={k}
                          value={k}
                          disabled={k === "track" && !detail.tracks.length}
                        >
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {r.kind === "track" ? (
                    <Select
                      value={r.trackId}
                      items={trackItems}
                      onValueChange={(v) => update(r.key, { trackId: v })}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Track"
                        aria-invalid={!r.trackId}
                      >
                        <SelectValue placeholder="Choose a track" />
                      </SelectTrigger>
                      <SelectContent>
                        {detail.tracks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-muted-foreground flex h-8 items-center text-xs">
                      {r.kind === "overall" ? "Across all projects" : "Most community votes"}
                    </div>
                  )}
                  <Input
                    value={r.name}
                    maxLength={80}
                    placeholder="Prize name, e.g. Grand prize"
                    aria-label={`Prize ${i + 1} name`}
                    aria-invalid={!r.name.trim()}
                    onChange={(e) => update(r.key, { name: e.target.value })}
                  />
                  <Input
                    value={r.amount}
                    maxLength={40}
                    placeholder="$1,000"
                    aria-label={`Prize ${i + 1} amount`}
                    onChange={(e) => update(r.key, { amount: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={Number.isNaN(r.rank) ? "" : r.rank}
                    aria-label={`Prize ${i + 1} rank`}
                    title="Rank (1 = first place)"
                    className="tabular-nums"
                    onChange={(e) => update(r.key, { rank: e.target.valueAsNumber })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.name || "prize"}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  value={r.description}
                  maxLength={400}
                  rows={2}
                  placeholder="Description (optional) — what winners receive, sponsor, eligibility…"
                  aria-label={`Prize ${i + 1} description`}
                  onChange={(e) => update(r.key, { description: e.target.value })}
                  className="min-h-0"
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>No prizes yet</EmptyTitle>
              <EmptyDescription>
                Prizes show on the event page and decide who gets winner certificates.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={add}>
                <Plus /> Add a prize
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2 border-t">
        <p className="text-muted-foreground text-sm">
          {invalid
            ? "Every prize needs a name (and a track for track prizes)."
            : dirty
              ? "You have unsaved changes."
              : "All changes saved."}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setRows(saved)} disabled={save.isPending}>
              Discard
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={!dirty || invalid || save.isPending}>
            {save.isPending ? <Spinner /> : <Save />} Save prizes
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
