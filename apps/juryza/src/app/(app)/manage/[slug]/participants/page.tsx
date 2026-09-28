"use client";

/**
 * /manage/<slug>/participants — who is taking part: every team with its
 * members, size and submission state, a flat list of team members, and
 * CSV/JSON exports of participants and teams.
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { Download, FileJson, FileSpreadsheet, Info, Search, UsersRound } from "lucide-react";

import { Alert, AlertDescription } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card } from "@juryza/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@juryza/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@juryza/ui/components/ui/input-group";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@juryza/ui/components/ui/tabs";

import { StatCard } from "@/components/page";
import { AvatarStack, UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useEvent } from "@/lib/queries";

interface Member {
  teamId: string;
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  role: string;
}
interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  lookingForMembers: boolean;
  createdAt: string;
  projectId: string | null;
  members: Member[];
}

export default function ParticipantsPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = useEvent(slug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["event", slug, "teams"],
    queryFn: () => api.get<{ maxTeamSize: number; teams: TeamRow[] }>(`/api/events/${slug}/teams`),
  });
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const teams = data?.teams ?? [];
  const max = data?.maxTeamSize ?? 0;
  const members = teams.flatMap((t) =>
    t.members.map((m) => ({ ...m, teamName: t.name, hasProject: Boolean(t.projectId) }))
  );
  const shownTeams = teams.filter(
    (t) =>
      !needle ||
      t.name.toLowerCase().includes(needle) ||
      t.members.some((m) => m.name.toLowerCase().includes(needle))
  );
  const shownMembers = members.filter(
    (m) =>
      !needle ||
      m.name.toLowerCase().includes(needle) ||
      (m.username ?? "").toLowerCase().includes(needle) ||
      m.teamName.toLowerCase().includes(needle)
  );
  const registered = event.data?.counts.participants ?? 0;
  const solo = Math.max(0, registered - members.length);
  const exportHref = (dataset: string, format: "csv" | "json") =>
    `/api/events/${slug}/export?dataset=${dataset}&format=${format}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Registered"
          value={isLoading ? "…" : formatNumber(registered)}
          icon={UsersRound}
        />
        <StatCard
          label="Teams"
          value={isLoading ? "…" : formatNumber(teams.length)}
          hint={`Max ${max} per team`}
        />
        <StatCard
          label="Without a team"
          value={isLoading ? "…" : formatNumber(solo)}
          hint="Registered, not on a team"
        />
        <StatCard
          label="Looking for members"
          value={isLoading ? "…" : formatNumber(teams.filter((t) => t.lookingForMembers).length)}
          hint="Teams open to new people"
        />
      </div>

      <Tabs defaultValue="teams" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="teams">
              Teams{" "}
              <Badge variant="secondary" className="tabular-nums">
                {teams.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="participants">
              Participants{" "}
              <Badge variant="secondary" className="tabular-nums">
                {members.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people or teams…"
                aria-label="Search"
              />
            </InputGroup>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <Download /> Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {(
                  [
                    ["participants", "Participants"],
                    ["teams", "Teams & members"],
                  ] as const
                ).map(([dataset, label], i) => (
                  <DropdownMenuGroup key={dataset}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{label}</DropdownMenuLabel>
                    <DropdownMenuItem render={<a href={exportHref(dataset, "csv")} download />}>
                      <FileSpreadsheet /> CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<a href={exportHref(dataset, "json")} download />}>
                      <FileJson /> JSON
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : (
          <>
            <TabsContent value="teams">
              {teams.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound />
                    </EmptyMedia>
                    <EmptyTitle>No teams yet</EmptyTitle>
                    <EmptyDescription>
                      Teams appear here as participants create them from the event page.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Card className="py-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead className="text-right">Size</TableHead>
                          <TableHead>Recruiting</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shownTeams.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="max-w-56">
                              <p className="truncate font-medium">{t.name}</p>
                              {t.description && (
                                <p className="text-muted-foreground truncate text-xs">
                                  {t.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <AvatarStack people={t.members} max={4} />
                                <span className="text-muted-foreground max-w-64 truncate text-xs">
                                  {t.members.map((m) => m.name).join(", ") || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span className={t.members.length >= max ? "font-medium" : undefined}>
                                {t.members.length}
                              </span>
                              <span className="text-muted-foreground">/{max}</span>
                            </TableCell>
                            <TableCell>
                              {t.lookingForMembers ? (
                                <Badge variant="outline">Looking</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {t.projectId ? (
                                <Link
                                  href={`/e/${slug}/projects/${t.projectId}`}
                                  className="hover:underline"
                                >
                                  <Badge>Submitted</Badge>
                                </Link>
                              ) : (
                                <Badge variant="secondary">No submission</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                              {formatDate(t.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {shownTeams.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-muted-foreground py-8 text-center"
                            >
                              No teams match “{q}”.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="participants" className="flex flex-col gap-3">
              <Alert>
                <Info />
                <AlertDescription>
                  This list shows people on a team.{" "}
                  {solo > 0
                    ? `${formatNumber(solo)} registered participant${solo === 1 ? " has" : "s have"} no team yet — `
                    : ""}
                  the full roster with emails and registration dates is in the{" "}
                  <a
                    className="text-foreground font-medium underline underline-offset-4"
                    href={exportHref("participants", "csv")}
                    download
                  >
                    participants CSV
                  </a>
                  .
                </AlertDescription>
              </Alert>
              <Card className="py-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Submission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shownMembers.map((m) => (
                        <TableRow key={`${m.teamId}-${m.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserAvatar name={m.name} image={m.image} className="size-7" />
                              <div className="min-w-0">
                                {m.username ? (
                                  <Link
                                    href={`/u/${m.username}`}
                                    className="block truncate font-medium hover:underline"
                                  >
                                    {m.name}
                                  </Link>
                                ) : (
                                  <p className="truncate font-medium">{m.name}</p>
                                )}
                                {m.username && (
                                  <p className="text-muted-foreground truncate text-xs">
                                    @{m.username}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{m.teamName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={m.role === "owner" ? "default" : "outline"}
                              className="capitalize"
                            >
                              {m.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {m.hasProject ? "Submitted" : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {shownMembers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                            {members.length ? `No one matches “${q}”.` : "No team members yet."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
