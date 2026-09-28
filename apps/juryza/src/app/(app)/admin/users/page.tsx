"use client";

import { useEffect, useState } from "react";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@juryza/ui/components/ui/alert-dialog";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import { Card } from "@juryza/ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@juryza/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@juryza/ui/components/ui/select";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@juryza/ui/components/ui/table";

import { PageHeader } from "@/components/page";
import { UserAvatar } from "@/components/user-avatar";
import { useViewer } from "@/components/viewer";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";

/**
 * Users & roles (admins): search and filter every account, change a platform
 * role, suspend or restore. Admins can't edit themselves — the API refuses it
 * too, so an instance always keeps an admin.
 */

const ROLES = ["participant", "judge", "organizer", "admin"] as const;
type Role = (typeof ROLES)[number];

interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  role: Role;
  banned: boolean | null;
  createdAt: string;
}
interface UsersPage {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

const ROLE_ITEMS = ROLES.map((r) => ({ value: r, label: r[0]?.toUpperCase() + r.slice(1) }));

export default function AdminUsersPage() {
  const viewer = useViewer();
  if (viewer?.role !== "admin") {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Admins only</EmptyTitle>
          <EmptyDescription>Managing accounts and roles needs the admin role.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return <UsersTable selfId={viewer.userId} />;
}

function UsersTable({ selfId }: { selfId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  const key = ["admin", "users", q, role, page];
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: key,
    queryFn: () => api.get<UsersPage>(`/api/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; banned?: boolean }) =>
      api.patch(`/api/admin/users/${id}`, body),
    onSuccess: (_r, v) => {
      toast.success(
        v.role ? `Role changed to ${v.role}` : v.banned ? "Account suspended" : "Account restored"
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Every account on this instance. Role changes apply on the user's next request; suspending signs them out everywhere."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or username…"
            aria-label="Search users"
          />
          {isFetching && !isLoading && (
            <InputGroupAddon align="inline-end">
              <Spinner />
            </InputGroupAddon>
          )}
        </InputGroup>
        <Select
          items={[{ value: null, label: "All roles" }, ...ROLE_ITEMS]}
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All roles</SelectItem>
            {ROLE_ITEMS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-muted-foreground text-sm sm:ml-auto">
            {formatNumber(data.total)} accounts
          </span>
        )}
      </div>

      {error ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Couldn't load users</EmptyTitle>
            <EmptyDescription>{error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !data?.users.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No accounts match</EmptyTitle>
            <EmptyDescription>Try a different search or role filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u) => {
                  const self = u.id === selfId;
                  const pending = update.isPending && update.variables?.id === u.id;
                  return (
                    <TableRow key={u.id} className={u.banned ? "opacity-70" : undefined}>
                      <TableCell>
                        <div className="flex min-w-56 items-center gap-3">
                          <UserAvatar name={u.name} image={u.image} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.name}{" "}
                              {self && (
                                <span className="text-muted-foreground font-normal">(you)</span>
                              )}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {u.email}
                              {u.username && ` · @${u.username}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          items={ROLE_ITEMS}
                          value={u.role}
                          disabled={self || pending}
                          onValueChange={(v) =>
                            v && v !== u.role && update.mutate({ id: u.id, role: v })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-36"
                            aria-label={`Role for ${u.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_ITEMS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant={u.banned ? "outline" : "ghost"}
                                size="sm"
                                disabled={self || pending}
                              />
                            }
                          >
                            {pending ? <Spinner /> : u.banned ? <RotateCcw /> : <Ban />}
                            {u.banned ? "Restore" : "Suspend"}
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.banned ? `Restore ${u.name}?` : `Suspend ${u.name}?`}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.banned
                                  ? "They'll be able to sign in again with their existing password."
                                  : "They're signed out everywhere and can't sign in until restored. Their projects and scores are kept."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogCancel
                                variant={u.banned ? "default" : "destructive"}
                                onClick={() => update.mutate({ id: u.id, banned: !u.banned })}
                              >
                                {u.banned ? "Restore account" : "Suspend account"}
                              </AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <span className="text-muted-foreground text-sm">
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
