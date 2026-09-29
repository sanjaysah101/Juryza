"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@juryza/ui/components/ui/input-group";
import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { Switch } from "@juryza/ui/components/ui/switch";

import { RichEditor } from "@/components/editor/rich-editor";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api } from "@/lib/api";
import { docToText, isEmptyDoc, parseRichDoc } from "@/lib/rich-text";

import { TagInput } from "../../projects/[id]/tag-input";

/**
 * Profile settings: everything on the public /u/<username> page — avatar,
 * name, handle, headline, bio, skills, links and the "open to a team" flag.
 * One save for the whole form; the button lights up only when something changed.
 */

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  username: string | null;
  image: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  skills: string[];
  lookingForTeam: boolean;
}

interface Form {
  name: string;
  username: string;
  image: string;
  headline: string;
  location: string;
  bio: string;
  skills: string[];
  websiteUrl: string;
  githubUrl: string;
  lookingForTeam: boolean;
}

const formOf = (u: Me): Form => ({
  name: u.name,
  username: u.username ?? "",
  image: u.image ?? "",
  headline: u.headline ?? "",
  location: u.location ?? "",
  bio: u.bio ?? "",
  skills: u.skills ?? [],
  websiteUrl: u.websiteUrl ?? "",
  githubUrl: u.githubUrl ?? "",
  lookingForTeam: u.lookingForTeam,
});

const USERNAME = /^[a-z0-9](?:[a-z0-9-_]{1,30}[a-z0-9])$/;
function urlError(v: string) {
  if (!v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? null : "Must be an http(s) link";
  } catch {
    return "Enter a full link starting with https://";
  }
}

export default function ProfileSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: Me }>("/api/me"),
  });
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }
  return <ProfileForm key={data.user.id} user={data.user} />;
}

function ProfileForm({ user }: { user: Me }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(() => formOf(user));
  const [form, setForm] = useState(saved);
  const [usernameTaken, setUsernameTaken] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const initialBioDoc = useMemo(() => parseRichDoc(user.bio), [user.bio]);

  const changed = (Object.keys(form) as (keyof Form)[]).filter(
    (k) => JSON.stringify(form[k]) !== JSON.stringify(saved[k])
  );
  const usernameError =
    usernameTaken && usernameTaken === form.username
      ? "That username is taken"
      : form.username && !USERNAME.test(form.username)
        ? "3–32 characters: lowercase letters, numbers, dashes, underscores"
        : null;
  const errors = {
    name: form.name.trim() ? null : "Your name is required",
    username: usernameError,
    image: urlError(form.image),
    websiteUrl: urlError(form.websiteUrl),
    githubUrl: urlError(form.githubUrl),
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const k of changed) {
        const v = form[k];
        if (typeof v === "string") {
          const t = v.trim();
          if (k === "name" || k === "username") {
            if (t) body[k] = t;
          } else body[k] = t || null;
        } else body[k] = v;
      }
      return api.patch<{ user: Me }>("/api/me", body);
    },
    onSuccess: ({ user: next }) => {
      const f = formOf(next);
      setSaved(f);
      setForm(f);
      queryClient.setQueryData(["me"], { user: next });
      toast.success("Profile saved");
      router.refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setUsernameTaken(form.username);
      toast.error(e.message);
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid && changed.length) save.mutate();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>
            Shown to organizers, judges and teammates.{" "}
            {saved.username && (
              <Link
                href={`/u/${saved.username}`}
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                View your profile <ExternalLink className="size-3" />
              </Link>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="image">Avatar</FieldLabel>
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={form.name}
                  image={errors.image ? null : form.image.trim() || null}
                  className="size-14 text-base"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Input
                    id="image"
                    value={form.image}
                    onChange={(e) => set("image", e.target.value)}
                    placeholder="https://…/avatar.png"
                    aria-invalid={errors.image ? true : undefined}
                  />
                  {errors.image ? (
                    <FieldError>{errors.image}</FieldError>
                  ) : (
                    <FieldDescription>
                      Link to a square image. Leave empty for initials.
                    </FieldDescription>
                  )}
                </div>
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={80}
                  aria-invalid={errors.name ? true : undefined}
                />
                {errors.name && <FieldError>{errors.name}</FieldError>}
              </Field>
              <Field data-invalid={errors.username ? true : undefined}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>/u/</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="username"
                    value={form.username}
                    onChange={(e) =>
                      set("username", e.target.value.toLowerCase().replace(/\s/g, ""))
                    }
                    maxLength={32}
                    placeholder="your-handle"
                    aria-invalid={errors.username ? true : undefined}
                  />
                </InputGroup>
                {errors.username && <FieldError>{errors.username}</FieldError>}
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="headline">Headline</FieldLabel>
                <Input
                  id="headline"
                  value={form.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  maxLength={120}
                  placeholder="Full-stack developer"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="location">Location</FieldLabel>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  maxLength={80}
                  placeholder="Berlin, remote"
                />
              </Field>
            </div>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="bio">Bio</FieldLabel>
                <span className="text-muted-foreground text-xs">
                  TipTap rich editor · Press{" "}
                  <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]">
                    /
                  </kbd>{" "}
                  for blocks
                </span>
              </div>
              <div className="border-input focus-within:border-ring focus-within:ring-ring/50 min-h-[140px] rounded-lg border bg-background px-3.5 py-2.5 transition-colors focus-within:ring-3">
                <RichEditor
                  value={initialBioDoc}
                  onChange={(doc) => set("bio", isEmptyDoc(doc) ? "" : JSON.stringify(doc))}
                  placeholder="What do you like building? What are you looking for? Type / for blocks or select text to format..."
                  className="min-h-[100px] text-sm"
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Select text for floating toolbar (bold, italic, links, code)</span>
                <span className="tabular-nums">
                  {docToText(parseRichDoc(form.bio)).length} characters
                </span>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="skills">Skills</FieldLabel>
              <div className="border-input focus-within:border-ring focus-within:ring-ring/50 rounded-lg border px-2.5 py-1 focus-within:ring-3">
                <TagInput
                  value={form.skills}
                  onChange={(v) => set("skills", v)}
                  max={20}
                  placeholder="Type a skill and press Enter"
                  aria-label="Add a skill"
                />
              </div>
              <FieldDescription>
                Up to 20 — helps teams looking for members find you.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links & availability</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={errors.websiteUrl ? true : undefined}>
                <FieldLabel htmlFor="website">Website</FieldLabel>
                <Input
                  id="website"
                  value={form.websiteUrl}
                  onChange={(e) => set("websiteUrl", e.target.value)}
                  placeholder="https://you.dev"
                  aria-invalid={errors.websiteUrl ? true : undefined}
                />
                {errors.websiteUrl && <FieldError>{errors.websiteUrl}</FieldError>}
              </Field>
              <Field data-invalid={errors.githubUrl ? true : undefined}>
                <FieldLabel htmlFor="github">GitHub</FieldLabel>
                <Input
                  id="github"
                  value={form.githubUrl}
                  onChange={(e) => set("githubUrl", e.target.value)}
                  placeholder="https://github.com/you"
                  aria-invalid={errors.githubUrl ? true : undefined}
                />
                {errors.githubUrl && <FieldError>{errors.githubUrl}</FieldError>}
              </Field>
            </div>
            <Field orientation="horizontal" className="justify-between rounded-lg border p-3">
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor="looking">Open to joining a team</FieldLabel>
                <FieldDescription>
                  Team owners browsing an event can see you're available.
                </FieldDescription>
              </div>
              <Switch
                id="looking"
                checked={form.lookingForTeam}
                onCheckedChange={(v) => set("lookingForTeam", v)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="bg-background/85 sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t px-1 py-3 backdrop-blur">
        {changed.length > 0 && (
          <span className="text-muted-foreground mr-auto text-sm">
            {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={!changed.length || save.isPending}
          onClick={() => setForm(saved)}
        >
          Discard
        </Button>
        <Button type="submit" disabled={!changed.length || invalid || save.isPending}>
          {save.isPending ? <Spinner /> : <Save />} Save changes
        </Button>
      </div>
    </form>
  );
}
