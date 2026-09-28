"use client";

import { useState } from "react";
import Link from "next/link";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@juryza/ui/components/ui/input-group";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { Switch } from "@juryza/ui/components/ui/switch";
import { Textarea } from "@juryza/ui/components/ui/textarea";

import { api } from "@/lib/api";
import { eventKey } from "@/lib/queries";

/**
 * "Create a team" dialog shared by the event overview and the team finder.
 * POST /api/events/:slug/teams, then shows the invite link to copy.
 */

export const eventTeamsKey = (slug: string) => ["event", slug, "teams"] as const;

export function CreateTeamDialog({ slug, trigger }: { slug: string; trigger: React.ReactElement }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [looking, setLooking] = useState(true);
  const [result, setResult] = useState<{ id: string; inviteUrl: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string; inviteUrl: string }>(`/api/events/${slug}/teams`, {
        name: name.trim(),
        description: description.trim() || null,
        lookingForMembers: looking,
      }),
    onSuccess: (r) => {
      setResult(r);
      toast.success("Team created");
      queryClient.invalidateQueries({ queryKey: eventKey(slug) });
    },
    onError: (e) => toast.error(e.message),
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && result) {
      setResult(null);
      setName("");
      setDescription("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <span className="bg-success/15 text-success mb-1 grid size-10 place-items-center rounded-xl">
                <PartyPopper className="size-5" />
              </span>
              <DialogTitle>Your team is ready</DialogTitle>
              <DialogDescription>
                Share this link with teammates — anyone who opens it can join while there are seats
                left.
              </DialogDescription>
            </DialogHeader>
            <CopyField value={result.inviteUrl} label="Invite link" />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Button nativeButton={false} render={<Link href={`/teams/${result.id}`} />}>
                Open team
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create a team</DialogTitle>
              <DialogDescription>
                You'll be the owner. You can invite teammates right after.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="team-name">Team name</FieldLabel>
                <Input
                  id="team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Night Owls"
                  minLength={2}
                  maxLength={60}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="team-description">What are you building?</FieldLabel>
                <Textarea
                  id="team-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The idea, and the skills you're looking for (optional)"
                  maxLength={500}
                  rows={3}
                />
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="team-looking">Looking for members</FieldLabel>
                  <FieldDescription>List the team in the team finder.</FieldDescription>
                </FieldContent>
                <Switch id="team-looking" checked={looking} onCheckedChange={setLooking} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || name.trim().length < 2}>
                {create.isPending && <Spinner />} Create team
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A read-only input with a copy button. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually");
    }
  }
  return (
    <InputGroup>
      <InputGroupInput
        value={value}
        readOnly
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-xs"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check /> : <Copy />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
