"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CalendarDays,
  FolderKanban,
  Gavel,
  GitBranch,
  Globe,
  MapPin,
  PencilLine,
  Sparkles,
  UserX,
} from "lucide-react";

import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card, CardContent } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";

import { UserAvatar } from "@/components/user-avatar";
import { useViewer } from "@/components/viewer";
import { api } from "@/lib/api";
import { formatDate, hueOf } from "@/lib/format";
import type { publicProfile } from "@/lib/server/people";
import type { Json } from "@/lib/types";

/** Public profile: who someone is, what they've built, where they've judged. */

type Profile = Json<NonNullable<Awaited<ReturnType<typeof publicProfile>>>>;

const ROLE_LABEL: Record<string, string> = {
  participant: "Participant",
  judge: "Judge",
  organizer: "Organizer",
  admin: "Admin",
};

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function githubHandle(url: string) {
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, "") || "GitHub";
  } catch {
    return "GitHub";
  }
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const viewer = useViewer();
  const { data, isLoading, error } = useQuery({
    queryKey: ["user", username],
    queryFn: () => api.get<Profile>(`/api/users/${encodeURIComponent(username)}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Empty className="my-24">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserX />
          </EmptyMedia>
          <EmptyTitle>No such user</EmptyTitle>
          <EmptyDescription>There's no profile at @{username}.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
            Browse events
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const { user: u, projects, judged, certificates } = data;
  const isMe = viewer?.userId === u.id;
  const hue = hueOf(u.name);

  return (
    <div className="flex flex-col">
      <div
        className="h-32 border-b sm:h-40"
        style={{
          background: `linear-gradient(135deg, oklch(0.7 0.12 ${hue} / 0.35), oklch(0.6 0.14 ${(hue + 60) % 360} / 0.2))`,
        }}
        aria-hidden
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-16 sm:px-6">
        <header className="-mt-12 flex flex-col gap-5 sm:-mt-14">
          <div className="flex items-end justify-between gap-4">
            <UserAvatar
              name={u.name}
              image={u.image}
              className="ring-background size-24 text-2xl ring-4 sm:size-28"
            />
            {isMe && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/settings/profile" />}
              >
                <PencilLine /> Edit profile
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">{u.name}</h1>
              {u.role !== "participant" && (
                <Badge variant="secondary">{ROLE_LABEL[u.role] ?? u.role}</Badge>
              )}
              {u.lookingForTeam && (
                <Badge className="bg-success/15 text-success">
                  <Sparkles /> Open to teams
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">@{u.username}</p>
            {u.headline && <p className="text-lg text-pretty">{u.headline}</p>}
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {u.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {u.location}
              </span>
            )}
            {u.websiteUrl && (
              <a
                href={u.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-foreground flex items-center gap-1.5"
              >
                <Globe className="size-4" /> {hostOf(u.websiteUrl)}
              </a>
            )}
            {u.githubUrl && (
              <a
                href={u.githubUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="hover:text-foreground flex items-center gap-1.5"
              >
                <GitBranch className="size-4" /> {githubHandle(u.githubUrl)}
              </a>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Joined{" "}
              {formatDate(u.createdAt, { month: "long", year: "numeric" })}
            </span>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-10">
            {u.bio && (
              <section className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-tight">About</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{u.bio}</p>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <FolderKanban className="text-muted-foreground size-5" /> Projects
              </h2>
              {projects.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {projects.map((p) => {
                    const ph = hueOf(p.title);
                    return (
                      <Link
                        key={p.id}
                        href={`/e/${p.eventSlug}/projects/${p.id}`}
                        className="group"
                      >
                        <Card className="h-full gap-0 py-0 transition-shadow group-hover:shadow-md">
                          {p.thumbnailUrl ? (
                            // biome-ignore lint/performance/noImgElement: user-supplied thumbnail from any host
                            <img
                              src={p.thumbnailUrl}
                              alt=""
                              className="aspect-2/1 w-full object-cover"
                            />
                          ) : (
                            <div
                              className="aspect-2/1 w-full"
                              style={{
                                background: `linear-gradient(135deg, oklch(0.72 0.13 ${ph}), oklch(0.5 0.16 ${(ph + 50) % 360}))`,
                              }}
                              aria-hidden
                            />
                          )}
                          <CardContent className="flex flex-col gap-1.5 p-4">
                            <p className="font-medium group-hover:underline">{p.title}</p>
                            {p.tagline && (
                              <p className="text-muted-foreground line-clamp-2 text-sm">
                                {p.tagline}
                              </p>
                            )}
                            <p className="text-muted-foreground mt-1 text-xs">
                              {p.eventName} · {p.teamName}
                            </p>
                            {p.techTags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.techTags.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="outline">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <Empty className="border py-10">
                  <EmptyHeader>
                    <EmptyTitle>No submitted projects yet</EmptyTitle>
                    <EmptyDescription>
                      {isMe
                        ? "Join an event and submit a project — it'll show up here."
                        : "Projects appear here once submitted."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {isMe && (
                    <EmptyContent>
                      <Button size="sm" nativeButton={false} render={<Link href="/events" />}>
                        Find an event
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            {u.skills.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">Skills</h2>
                <div className="flex flex-wrap gap-1.5">
                  {u.skills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {judged.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Gavel className="text-muted-foreground size-4" /> Judging panels
                </h2>
                <ul className="flex flex-col gap-1">
                  {judged.map((j) => (
                    <li key={j.slug}>
                      <Link
                        href={`/e/${j.slug}`}
                        className="hover:bg-muted/60 -mx-2 block rounded-md px-2 py-1.5 text-sm"
                      >
                        {j.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {certificates.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Award className="text-muted-foreground size-4" /> Certificates
                </h2>
                <div className="flex flex-col gap-2">
                  {certificates.map((c) => (
                    <Link
                      key={c.serial}
                      href={`/certificates/${c.serial}`}
                      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <span className="bg-warning/20 text-warning-foreground grid size-8 shrink-0 place-items-center rounded-lg">
                        <Award className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.eventName}</p>
                        <p className="text-muted-foreground truncate text-xs capitalize">
                          {c.kind} · {formatDate(c.issuedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {!u.skills.length && !judged.length && !certificates.length && (
              <p className="text-muted-foreground text-sm">
                No skills, panels or certificates yet.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
