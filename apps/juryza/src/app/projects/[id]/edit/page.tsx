"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import { Field, FieldLabel } from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@juryza/ui/components/ui/select";
import { Textarea } from "@juryza/ui/components/ui/textarea";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

interface ProjectData {
  id: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  description: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  videoUrl: string | null;
  trackId: string | null;
  techTags: string[] | null;
  status: string;
}

/**
 * Project editor (T1). Draft-and-edit until the deadline: the backend refuses a
 * PATCH once the event is closed, so this form is a thin editor over the API.
 * "Save draft" keeps status draft; "Submit" flips it to submitted.
 */
export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = auth.useSession();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data: proj } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.get<{ project: ProjectData }>(`/api/projects/${id}`),
    enabled: status === "authenticated",
  });
  const { data: tracks } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api.get<{ tracks: { id: string; name: string }[] }>("/api/tracks"),
  });

  const [form, setForm] = useState<Partial<ProjectData>>({});
  useEffect(() => {
    if (proj?.project) setForm(proj.project);
  }, [proj]);

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      api.patch(`/api/projects/${id}`, {
        title: form.title,
        tagline: form.tagline,
        summary: form.summary,
        description: form.description,
        repoUrl: form.repoUrl ?? "",
        liveUrl: form.liveUrl ?? "",
        videoUrl: form.videoUrl ?? "",
        trackId: form.trackId ?? null,
        techTags: form.techTags ?? [],
        submit,
      }),
    onSuccess: (_r, submit) => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      toast.success(submit ? "Project submitted" : "Draft saved");
      if (submit) router.push("/dashboard");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof ProjectData>(key: K, value: ProjectData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit project</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Status: <span className="capitalize">{form.status ?? "draft"}</span>
      </p>

      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(false);
        }}
      >
        <Field>
          <FieldLabel htmlFor="title">Title</FieldLabel>
          <Input
            id="title"
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
          <Input
            id="tagline"
            value={form.tagline ?? ""}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="One line that sells it"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="track">Track</FieldLabel>
          <Select value={form.trackId ?? ""} onValueChange={(v) => set("trackId", v ?? null)}>
            <SelectTrigger id="track">
              <SelectValue placeholder="Choose a track" />
            </SelectTrigger>
            <SelectContent>
              {tracks?.tracks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="summary">Summary</FieldLabel>
          <Textarea
            id="summary"
            value={form.summary ?? ""}
            onChange={(e) => set("summary", e.target.value)}
            rows={3}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={6}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="repoUrl">Repository URL</FieldLabel>
            <Input
              id="repoUrl"
              value={form.repoUrl ?? ""}
              onChange={(e) => set("repoUrl", e.target.value)}
              placeholder="https://github.com/…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="liveUrl">Live URL</FieldLabel>
            <Input
              id="liveUrl"
              value={form.liveUrl ?? ""}
              onChange={(e) => set("liveUrl", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="videoUrl">Demo video URL</FieldLabel>
            <Input
              id="videoUrl"
              value={form.videoUrl ?? ""}
              onChange={(e) => set("videoUrl", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-2 flex gap-3">
          <Button type="submit" variant="outline" disabled={save.isPending}>
            Save draft
          </Button>
          <Button type="button" onClick={() => save.mutate(true)} disabled={save.isPending}>
            Submit project
          </Button>
        </div>
      </form>
    </main>
  );
}
