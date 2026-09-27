"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CalendarRange, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";
import { Input } from "@juryza/ui/components/ui/input";
import { Textarea } from "@juryza/ui/components/ui/textarea";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

const defaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 16);
};

export default function NewEventPage() {
  const { status, user } = auth.useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    submissionsClose: defaultDate(),
    tracks: "AI, Design, DevTools, Infrastructure",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "authenticated" && user?.role !== "organizer" && user?.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <div className="border-border/70 bg-card rounded-2xl border p-8 text-center">
          <h1 className="text-2xl font-semibold">Organizer access required</h1>
          <p className="text-muted-foreground mt-2">
            Create a new hackathon from the organizer dashboard.
          </p>
          <div className="mt-6">
            <Button nativeButton={false} render={<Link href="/login" />}>
              Sign in as organizer
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const submit = async () => {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      submissionsClose: new Date(form.submissionsClose).toISOString(),
      tracks: form.tracks
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      prizes: [{ name: "Grand Prize", amount: "$1,000", rank: 1 }],
      rubric: [
        { key: "innovation", label: "Innovation", weight: 0.35 },
        { key: "execution", label: "Execution", weight: 0.4 },
        { key: "presentation", label: "Presentation", weight: 0.25 },
      ],
    };

    try {
      await api.post<{ id: string }>("/api/events", payload);
      toast.success("Hackathon created");
      router.push("/organizer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to create the event");
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-primary text-sm font-medium uppercase tracking-[0.18em]">Events</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create a new hackathon</h1>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/organizer" />}>
          Back to dashboard
        </Button>
      </div>

      <div className="border-border/70 bg-card rounded-2xl border p-6 shadow-sm">
        <div className="grid gap-5">
          <div>
            <label htmlFor="event-name" className="mb-2 block text-sm font-medium">
              Event name
            </label>
            <Input
              id="event-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Example: Summer Launch 2026"
            />
          </div>

          <div>
            <label htmlFor="event-slug" className="mb-2 block text-sm font-medium">
              Slug
            </label>
            <Input
              id="event-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="summer-launch-2026"
            />
          </div>

          <div>
            <label htmlFor="event-description" className="mb-2 block text-sm font-medium">
              Description
            </label>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Tell teams what this event is about."
            />
          </div>

          <div>
            <label
              htmlFor="event-deadline"
              className="mb-2 flex items-center gap-2 text-sm font-medium"
            >
              <CalendarRange className="size-4" /> Submission deadline
            </label>
            <Input
              id="event-deadline"
              type="datetime-local"
              value={form.submissionsClose}
              onChange={(e) => setForm({ ...form, submissionsClose: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="event-tracks" className="mb-2 block text-sm font-medium">
              Tracks
            </label>
            <Input
              id="event-tracks"
              value={form.tracks}
              onChange={(e) => setForm({ ...form, tracks: e.target.value })}
              placeholder="AI, Design, DevTools"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} className="gap-2">
              <PlusCircle className="size-4" /> Create event
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
