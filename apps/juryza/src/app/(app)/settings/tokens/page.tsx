"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCode2, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
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
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@juryza/ui/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
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

import { CopyButton } from "@/components/copy-button";
import { api } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";

/**
 * Personal API tokens: mint one (shown exactly once, with a ready-to-run curl
 * example), see when each was last used, and revoke. Only a hash is stored.
 */

interface Token {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function TokensPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me", "tokens"],
    queryFn: () => api.get<{ tokens: Token[] }>("/api/me/tokens"),
  });
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [minted, setMinted] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://your-juryza");
  useEffect(() => setOrigin(window.location.origin), []);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string; token: string }>("/api/me/tokens", { label: label.trim() }),
    onSuccess: ({ token }) => {
      setMinted(token);
      void queryClient.invalidateQueries({ queryKey: ["me", "tokens"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/me/tokens?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Token revoked");
      void queryClient.invalidateQueries({ queryKey: ["me", "tokens"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const curl = `curl -H "Authorization: Bearer ${minted ?? "<token>"}" ${origin}/api/me`;
  const tokens = data?.tokens ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>API tokens</CardTitle>
            <CardDescription>
              Tokens act as you on the REST API — same permissions, no browser needed. Send as{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-xs">Authorization: Bearer …</code>
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/docs/api" />}
            >
              <FileCode2 /> API reference
            </Button>
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                  setMinted(null);
                  setLabel("");
                }
              }}
            >
              <DialogTrigger render={<Button size="sm" />}>
                <Plus /> New token
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                {minted ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Copy your new token</DialogTitle>
                      <DialogDescription>
                        This is the only time it's shown. Store it somewhere safe.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-md px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {minted}
                        </code>
                        <CopyButton value={minted} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-muted-foreground text-xs font-medium">Try it</p>
                        <pre className="bg-muted overflow-x-auto rounded-md px-3 py-2 font-mono text-xs">
                          {curl}
                        </pre>
                        <div>
                          <CopyButton value={curl} label="Copy command" />
                        </div>
                      </div>
                      <Alert>
                        <TriangleAlert />
                        <AlertTitle>Treat it like a password</AlertTitle>
                        <AlertDescription>
                          Anyone with this token can act as you. Revoke it here if it leaks.
                        </AlertDescription>
                      </Alert>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setOpen(false)}>Done</Button>
                    </DialogFooter>
                  </>
                ) : (
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (label.trim()) create.mutate();
                    }}
                  >
                    <DialogHeader>
                      <DialogTitle>Create a token</DialogTitle>
                      <DialogDescription>
                        Give it a name you'll recognise later, like where it's used.
                      </DialogDescription>
                    </DialogHeader>
                    <Field>
                      <FieldLabel htmlFor="token-label">Label</FieldLabel>
                      <Input
                        id="token-label"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        maxLength={60}
                        placeholder="CI export script"
                        autoFocus
                      />
                      <FieldDescription>Up to 60 characters.</FieldDescription>
                    </Field>
                    <DialogFooter>
                      <Button type="submit" disabled={!label.trim() || create.isPending}>
                        {create.isPending && <Spinner />} Create token
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : tokens.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>No tokens yet</EmptyTitle>
                <EmptyDescription>
                  Create one to script exports, sync results or build an integration.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell>
                        <code className="text-muted-foreground font-mono text-xs">{t.prefix}…</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.lastUsedAt ? relativeTime(t.lastUsedAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Revoke ${t.label}`}
                                disabled={revoke.isPending && revoke.variables === t.id}
                              />
                            }
                          >
                            {revoke.isPending && revoke.variables === t.id ? (
                              <Spinner />
                            ) : (
                              <Trash2 />
                            )}
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke “{t.label}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Anything using this token stops working immediately. This can't be
                                undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogCancel
                                variant="destructive"
                                onClick={() => revoke.mutate(t.id)}
                              >
                                Revoke
                              </AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
