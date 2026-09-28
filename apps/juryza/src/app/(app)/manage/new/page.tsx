"use client";

/**
 * /manage/new — the create-event wizard: basics → schedule → tracks → rules →
 * review. Creates the event with POST /api/events (a draft unless "Publish
 * immediately" is ticked) and opens its console.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Globe,
  Laptop,
  MapPin,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
  Tags,
  UsersRound,
  Vote,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@juryza/ui/components/ui/alert";
import { Badge } from "@juryza/ui/components/ui/badge";
import { Button } from "@juryza/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@juryza/ui/components/ui/card";
import { Checkbox } from "@juryza/ui/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@juryza/ui/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@juryza/ui/components/ui/field";
import { Input } from "@juryza/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@juryza/ui/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@juryza/ui/components/ui/radio-group";
import { Separator } from "@juryza/ui/components/ui/separator";
import { Slider } from "@juryza/ui/components/ui/slider";
import { Spinner } from "@juryza/ui/components/ui/spinner";
import { cn } from "@juryza/ui/lib/utils";

import { coverStyle, EventCover } from "@/components/event-bits";
import { PageHeader } from "@/components/page";
import { useViewer } from "@/components/viewer";
import { ApiError, api } from "@/lib/api";
import { formatDateTime, pluralize } from "@/lib/format";
import { hasAtLeast } from "@/lib/roles";

type Mode = "online" | "in-person" | "hybrid";
type Access = "authenticated" | "email" | "open";

interface Draft {
  name: string;
  slug: string;
  slugEdited: boolean;
  tagline: string;
  mode: Mode;
  location: string;
  hue: number;
  submissionsOpen: string;
  submissionsClose: string;
  judgingClose: string;
  votingOpen: string;
  votingClose: string;
  tracks: string[];
  maxTeamSize: number;
  reviewsPerProject: number;
  votingAccess: Access;
  domains: string;
  voteBudget: number;
  publish: boolean;
}

const STEPS = [
  { key: "basics", label: "Basics", icon: Sparkles },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
  { key: "tracks", label: "Tracks", icon: Tags },
  { key: "rules", label: "Rules & settings", icon: UsersRound },
  { key: "review", label: "Review", icon: Rocket },
] as const;

const HUES = [250, 285, 320, 10, 45, 150, 185, 215];
const TRACK_SUGGESTIONS = [
  "AI & machine learning",
  "Developer tools",
  "Climate",
  "Health",
  "Education",
  "Fintech",
  "Accessibility",
  "Security",
  "Open source",
  "Social impact",
  "Hardware & IoT",
  "Best beginner project",
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

/** A Date as the value of a `datetime-local` input (local time, minute precision). */
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const iso = (local: string) => (local ? new Date(local).toISOString() : null);
const time = (local: string) => (local ? new Date(local).getTime() : null);

function nextWeekday(day: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7 || 7));
  d.setHours(hour, 0, 0, 0);
  return d;
}
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

type Schedule = Pick<
  Draft,
  "submissionsOpen" | "submissionsClose" | "judgingClose" | "votingOpen" | "votingClose"
>;

/** Submissions run `hours` from the next `day` at `hour`; judging and voting take `reviewHours` after. */
function preset(day: number, hour: number, hours: number, reviewHours: number): Schedule {
  const open = nextWeekday(day, hour);
  const close = addHours(open, hours);
  return {
    submissionsOpen: toLocalInput(open),
    submissionsClose: toLocalInput(close),
    judgingClose: toLocalInput(addHours(close, reviewHours)),
    votingOpen: toLocalInput(close),
    votingClose: toLocalInput(addHours(close, reviewHours)),
  };
}

const PRESETS: { label: string; hint: string; build: () => Schedule }[] = [
  {
    label: "48-hour hackathon",
    hint: "Starts next Friday 18:00",
    build: () => preset(5, 18, 48, 24),
  },
  {
    label: "72-hour hackathon",
    hint: "Starts next Friday 18:00 (3 days)",
    build: () => preset(5, 18, 72, 24),
  },
  {
    label: "One-week sprint",
    hint: "Monday 09:00 → Monday 09:00",
    build: () => preset(1, 9, 7 * 24, 72),
  },
  {
    label: "Month-long challenge",
    hint: "30 days, one week of judging",
    build: () => preset(1, 9, 30 * 24, 7 * 24),
  },
];

const initial = (): Draft => ({
  name: "",
  slug: "",
  slugEdited: false,
  tagline: "",
  mode: "online",
  location: "",
  hue: 250,
  submissionsOpen: "",
  submissionsClose: "",
  judgingClose: "",
  votingOpen: "",
  votingClose: "",
  tracks: [],
  maxTeamSize: 4,
  reviewsPerProject: 3,
  votingAccess: "authenticated",
  domains: "",
  voteBudget: 16,
  publish: false,
});

type Errors = Partial<Record<keyof Draft, string>>;

function validate(step: number, d: Draft): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.name.trim().length < 3) e.name = "Give the event a name (at least 3 characters)";
    if (d.slug.length < 3) e.slug = "At least 3 characters";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug))
      e.slug = "Lowercase letters, numbers and single dashes only";
    else if (["import", "new", "api", "admin", "settings"].includes(d.slug))
      e.slug = "That URL is reserved";
    if (d.tagline.length > 140) e.tagline = "Keep it under 140 characters";
    if (d.mode !== "online" && !d.location.trim()) e.location = "Where is it happening?";
  }
  if (step === 1) {
    const open = time(d.submissionsOpen);
    const close = time(d.submissionsClose);
    const judging = time(d.judgingClose);
    const vOpen = time(d.votingOpen);
    const vClose = time(d.votingClose);
    if (close === null) e.submissionsClose = "The submission deadline is required";
    if (open !== null && close !== null && open >= close)
      e.submissionsClose = "Must be after submissions open";
    if (judging !== null && close !== null && judging <= close)
      e.judgingClose = "Judging must close after the submission deadline";
    if (vOpen !== null && vClose !== null && vOpen >= vClose)
      e.votingClose = "Must be after voting opens";
    if (vClose !== null && close !== null && vClose <= close)
      e.votingClose = "Voting should close after the submission deadline";
  }
  if (step === 3) {
    if (d.maxTeamSize < 1 || d.maxTeamSize > 20) e.maxTeamSize = "Between 1 and 20";
    if (d.reviewsPerProject < 1 || d.reviewsPerProject > 10)
      e.reviewsPerProject = "Between 1 and 10";
    if (d.voteBudget < 1 || d.voteBudget > 400) e.voteBudget = "Between 1 and 400";
    if (d.votingAccess === "email" && !parseDomains(d.domains).length)
      e.domains = "Add at least one allowed email domain";
  }
  return e;
}

const parseDomains = (s: string) =>
  s
    .split(/[\s,]+/)
    .map((x) => x.trim().toLowerCase().replace(/^@/, ""))
    .filter((x) => x.length >= 3);

export default function NewEventPage() {
  const viewer = useViewer();
  const organizer = hasAtLeast(viewer?.role, "organizer");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Default schedule is computed in the browser (local timezone), not during SSR.
  useEffect(() => {
    setD((prev) => (prev.submissionsClose ? prev : { ...prev, ...preset(5, 18, 48, 24) }));
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string; slug: string }>("/api/events", {
        name: d.name.trim(),
        slug: d.slug,
        tagline: d.tagline.trim() || null,
        mode: d.mode,
        location: d.mode === "online" ? null : d.location.trim() || null,
        hue: d.hue,
        visibility: d.publish ? "published" : "draft",
        submissionsOpen: iso(d.submissionsOpen),
        submissionsClose: iso(d.submissionsClose),
        judgingClose: iso(d.judgingClose),
        votingOpen: iso(d.votingOpen),
        votingClose: iso(d.votingClose),
        tracks: d.tracks,
        maxTeamSize: d.maxTeamSize,
        reviewsPerProject: d.reviewsPerProject,
        votingAccess: d.votingAccess,
        votingEmailDomains: d.votingAccess === "email" ? parseDomains(d.domains) : [],
        voteBudget: d.voteBudget,
      }),
    onSuccess: async (res) => {
      toast.success(d.publish ? "Event created and published" : "Draft event created");
      await queryClient.invalidateQueries({ queryKey: ["me", "overview"] });
      await queryClient.invalidateQueries({ queryKey: ["manage", "events"] });
      router.push(`/manage/${res.slug}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setErrors({ slug: e.message });
        setStep(0);
        return;
      }
      setServerError(e.message);
    },
  });

  const next = () => {
    const e = validate(step, d);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goTo = (i: number) => {
    if (i <= step) return setStep(i);
    for (let s = step; s < i; s++) {
      const e = validate(s, d);
      if (Object.values(e).some(Boolean)) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setStep(i);
  };

  if (!organizer) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Organizer role required</EmptyTitle>
          <EmptyDescription>
            Creating and running events is available to organizers. Ask a platform admin to upgrade
            your account, or explore events you can join in the meantime.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/events" />}>
            Explore events
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/manage" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> My events
          </Link>
        }
        title="Create an event"
        description="Five quick steps. Everything can be changed later from the event's console."
      />

      <Stepper step={step} onSelect={goTo} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>
              Step {step + 1} · {STEPS[step]?.label}
            </CardTitle>
            <CardDescription>{STEP_HELP[step]}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && <BasicsStep d={d} set={set} errors={errors} />}
            {step === 1 && <ScheduleStep d={d} set={set} setD={setD} errors={errors} />}
            {step === 2 && <TracksStep d={d} set={set} />}
            {step === 3 && <RulesStep d={d} set={set} errors={errors} />}
            {step === 4 && <ReviewStep d={d} set={set} onEdit={setStep} />}
            {serverError && step === 4 && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Couldn't create the event</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-2 border-t">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setServerError(null);
                  create.mutate();
                }}
                disabled={create.isPending}
              >
                {create.isPending ? <Spinner /> : <Rocket />}
                {d.publish ? "Create & publish" : "Create draft"}
              </Button>
            )}
          </CardFooter>
        </Card>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Preview
          </p>
          <Card className="gap-0 overflow-hidden py-0">
            <EventCover hue={d.hue} className="flex h-32 items-end p-4">
              <span className="text-lg font-semibold text-white drop-shadow">
                {d.name.trim() || "Your event"}
              </span>
            </EventCover>
            <CardContent className="flex flex-col gap-2 p-4 text-sm">
              <p className="text-muted-foreground line-clamp-2">
                {d.tagline || "A one-line tagline appears here."}
              </p>
              <p className="flex items-center gap-1.5">
                <ModeIcon mode={d.mode} className="text-muted-foreground size-3.5" />
                <span className="capitalize">{d.mode}</span>
                {d.mode !== "online" && d.location && (
                  <span className="text-muted-foreground truncate">· {d.location}</span>
                )}
              </p>
              {d.submissionsClose && (
                <p className="text-muted-foreground text-xs">
                  Deadline {formatDateTime(new Date(d.submissionsClose))}
                </p>
              )}
              {d.tracks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.tracks.slice(0, 4).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {d.tracks.length > 4 && <Badge variant="outline">+{d.tracks.length - 4}</Badge>}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-muted-foreground font-mono text-xs break-all">
            /e/{d.slug || "your-event"}
          </p>
        </aside>
      </div>
    </>
  );
}

const STEP_HELP = [
  "Name your event and pick its look. The URL is generated from the name — you can edit it.",
  "When submissions open and close, when judging ends, and the community voting window.",
  "Tracks are the categories projects compete in. Optional — you can add them later.",
  "Team size, how many judges review each project, and who may vote.",
  "Check everything, then create. Drafts are only visible to you until published.",
];

function Stepper({ step, onSelect }: { step: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.key} className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3",
                  current && "border-primary bg-primary/10 text-foreground font-medium",
                  done && "text-foreground hover:bg-muted",
                  !current && !done && "text-muted-foreground hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-xs tabular-nums",
                    done
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className={cn("h-px w-6", done ? "bg-primary" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ModeIcon({ mode, className }: { mode: Mode; className?: string }) {
  const Icon = mode === "online" ? Laptop : mode === "in-person" ? MapPin : Globe;
  return <Icon className={className} />;
}

type SetFn = <K extends keyof Draft>(k: K, v: Draft[K]) => void;

function BasicsStep({ d, set, errors }: { d: Draft; set: SetFn; errors: Errors }) {
  return (
    <FieldGroup>
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="name">Event name</FieldLabel>
        <Input
          id="name"
          autoFocus
          value={d.name}
          maxLength={80}
          placeholder="Spring Build Weekend 2027"
          aria-invalid={Boolean(errors.name)}
          onChange={(e) => {
            set("name", e.target.value);
            if (!d.slugEdited) set("slug", slugify(e.target.value));
          }}
        />
        <FieldError>{errors.name}</FieldError>
      </Field>

      <Field data-invalid={Boolean(errors.slug)}>
        <FieldLabel htmlFor="slug">Public URL</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>/e/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="slug"
            value={d.slug}
            maxLength={48}
            placeholder="spring-build-2027"
            aria-invalid={Boolean(errors.slug)}
            onChange={(e) => {
              set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              set("slugEdited", true);
            }}
          />
        </InputGroup>
        {errors.slug ? (
          <FieldError>{errors.slug}</FieldError>
        ) : (
          <FieldDescription>
            Your event will live at{" "}
            <span className="text-foreground font-mono">/e/{d.slug || "…"}</span>
            {d.slugEdited && (
              <>
                {" · "}
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    set("slug", slugify(d.name));
                    set("slugEdited", false);
                  }}
                >
                  reset from name
                </button>
              </>
            )}
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(errors.tagline)}>
        <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
        <Input
          id="tagline"
          value={d.tagline}
          placeholder="Build something people want in 48 hours."
          onChange={(e) => set("tagline", e.target.value)}
        />
        <FieldDescription className="flex justify-between">
          <span>Shown on cards and at the top of the event page.</span>
          <span className="tabular-nums">{d.tagline.length}/140</span>
        </FieldDescription>
        <FieldError>{errors.tagline}</FieldError>
      </Field>

      <Field>
        <FieldTitle>Format</FieldTitle>
        <RadioGroup
          value={d.mode}
          onValueChange={(v) => set("mode", v as Mode)}
          className="grid gap-2 sm:grid-cols-3"
        >
          {(
            [
              ["online", "Online", "Remote, anywhere"],
              ["in-person", "In person", "One venue"],
              ["hybrid", "Hybrid", "Venue + remote"],
            ] as const
          ).map(([value, label, hint]) => (
            <FieldLabel key={value} htmlFor={`mode-${value}`}>
              <Field orientation="horizontal">
                <RadioGroupItem value={value} id={`mode-${value}`} />
                <FieldContent>
                  <FieldTitle>
                    <ModeIcon mode={value} className="size-3.5" /> {label}
                  </FieldTitle>
                  <FieldDescription>{hint}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </Field>

      {d.mode !== "online" && (
        <Field data-invalid={Boolean(errors.location)}>
          <FieldLabel htmlFor="location">Location</FieldLabel>
          <Input
            id="location"
            value={d.location}
            maxLength={120}
            placeholder="Auckland Town Hall, Auckland"
            onChange={(e) => set("location", e.target.value)}
          />
          <FieldError>{errors.location}</FieldError>
        </Field>
      )}

      <Field>
        <FieldTitle>Cover colour</FieldTitle>
        <div className="flex flex-wrap items-center gap-2">
          {HUES.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={`Hue ${h}`}
              aria-pressed={d.hue === h}
              onClick={() => set("hue", h)}
              className={cn(
                "focus-visible:ring-ring/50 size-8 rounded-full ring-offset-2 ring-offset-background transition outline-none focus-visible:ring-3",
                d.hue === h && "ring-foreground ring-2"
              )}
              style={coverStyle(h)}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Slider
            value={d.hue}
            min={0}
            max={360}
            onValueChange={(v) => set("hue", Array.isArray(v) ? (v[0] ?? 0) : v)}
            aria-label="Cover hue"
          />
          <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
            {d.hue}°
          </span>
        </div>
        <EventCover hue={d.hue} className="h-20 rounded-lg" />
      </Field>
    </FieldGroup>
  );
}

function DateField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  optional = true,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <span className="text-muted-foreground font-normal">(optional)</span> : null}
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          type="datetime-local"
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
        {optional && value && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
          >
            <X />
          </Button>
        )}
      </div>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <FieldDescription>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}

function ScheduleStep({
  d,
  set,
  setD,
  errors,
}: {
  d: Draft;
  set: SetFn;
  setD: React.Dispatch<React.SetStateAction<Draft>>;
  errors: Errors;
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Start from a preset</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setD((prev) => ({ ...prev, ...p.build() }))}
              className="hover:bg-muted focus-visible:ring-ring/50 flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3"
            >
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-muted-foreground text-xs">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <Separator />
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <DateField
            id="submissionsOpen"
            label="Submissions open"
            hint="Leave empty to open immediately."
            value={d.submissionsOpen}
            onChange={(v) => set("submissionsOpen", v)}
            error={errors.submissionsOpen}
          />
          <DateField
            id="submissionsClose"
            label="Submission deadline"
            optional={false}
            hint="Projects lock at this moment."
            value={d.submissionsClose}
            onChange={(v) => set("submissionsClose", v)}
            error={errors.submissionsClose}
          />
        </div>
        <DateField
          id="judgingClose"
          label="Judging closes"
          hint="Judges can't score after this."
          value={d.judgingClose}
          onChange={(v) => set("judgingClose", v)}
          error={errors.judgingClose}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <DateField
            id="votingOpen"
            label="Community voting opens"
            value={d.votingOpen}
            onChange={(v) => set("votingOpen", v)}
            error={errors.votingOpen}
          />
          <DateField
            id="votingClose"
            label="Community voting closes"
            hint="Leave both empty to skip the community vote."
            value={d.votingClose}
            onChange={(v) => set("votingClose", v)}
            error={errors.votingClose}
          />
        </div>
      </FieldGroup>
      <p className="text-muted-foreground text-xs">
        Times are in your timezone ({tz}) and stored in UTC.
      </p>
    </div>
  );
}

function TracksStep({ d, set }: { d: Draft; set: SetFn }) {
  const [value, setValue] = useState("");
  const add = (name: string) => {
    const t = name.trim().slice(0, 60);
    if (!t || d.tracks.some((x) => x.toLowerCase() === t.toLowerCase()) || d.tracks.length >= 30)
      return;
    set("tracks", [...d.tracks, t]);
  };
  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(value);
          setValue("");
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a track, e.g. Climate"
          aria-label="Track name"
          maxLength={60}
        />
        <Button type="submit" variant="outline" disabled={!value.trim()}>
          <Plus /> Add
        </Button>
      </form>

      {d.tracks.length ? (
        <div className="flex flex-wrap gap-2">
          {d.tracks.map((t) => (
            <span
              key={t}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() =>
                  set(
                    "tracks",
                    d.tracks.filter((x) => x !== t)
                  )
                }
                className="hover:bg-foreground/10 focus-visible:ring-ring/50 grid size-5 place-items-center rounded-full outline-none focus-visible:ring-2"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          No tracks yet — every project will compete in a single pool.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Suggestions
        </p>
        <div className="flex flex-wrap gap-2">
          {TRACK_SUGGESTIONS.filter((s) => !d.tracks.includes(s)).map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => add(s)}>
              <Plus /> {s}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  error?: string;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(value) ? "" : value}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="tabular-nums"
      />
      {error ? <FieldError>{error}</FieldError> : <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

function RulesStep({ d, set, errors }: { d: Draft; set: SetFn; errors: Errors }) {
  const maxVotes = Math.floor(Math.sqrt(Math.max(1, d.voteBudget || 1)));
  return (
    <FieldGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField
          id="maxTeamSize"
          label="Max team size"
          hint="Solo entries are always allowed."
          value={d.maxTeamSize}
          min={1}
          max={20}
          onChange={(n) => set("maxTeamSize", n)}
          error={errors.maxTeamSize}
        />
        <NumberField
          id="reviewsPerProject"
          label="Reviews per project"
          hint="Independent judges who score each project."
          value={d.reviewsPerProject}
          min={1}
          max={10}
          onChange={(n) => set("reviewsPerProject", n)}
          error={errors.reviewsPerProject}
        />
      </div>

      <Separator />

      <Field>
        <FieldTitle>
          <Vote className="size-4" /> Who can vote in the community vote?
        </FieldTitle>
        <RadioGroup value={d.votingAccess} onValueChange={(v) => set("votingAccess", v as Access)}>
          {(
            [
              [
                "authenticated",
                "Signed-in users",
                "Anyone with a Juryza account. One ballot per account.",
              ],
              [
                "email",
                "Verified email",
                "Voters confirm an email address, optionally restricted to your domains.",
              ],
              [
                "open",
                "Open link",
                "Anyone with the link. Easiest, but least resistant to ballot stuffing.",
              ],
            ] as const
          ).map(([value, label, hint]) => (
            <FieldLabel key={value} htmlFor={`access-${value}`}>
              <Field orientation="horizontal">
                <RadioGroupItem value={value} id={`access-${value}`} />
                <FieldContent>
                  <FieldTitle>{label}</FieldTitle>
                  <FieldDescription>{hint}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </Field>

      {d.votingAccess === "email" && (
        <Field data-invalid={Boolean(errors.domains)}>
          <FieldLabel htmlFor="domains">Allowed email domains</FieldLabel>
          <Input
            id="domains"
            value={d.domains}
            placeholder="university.edu, company.com"
            onChange={(e) => set("domains", e.target.value)}
          />
          {errors.domains ? (
            <FieldError>{errors.domains}</FieldError>
          ) : (
            <FieldDescription>
              Comma-separated. Only addresses at these domains can verify and vote.
            </FieldDescription>
          )}
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <NumberField
          id="voteBudget"
          label="Vote credits per voter"
          hint="Quadratic voting budget."
          value={d.voteBudget}
          min={1}
          max={400}
          onChange={(n) => set("voteBudget", n)}
          error={errors.voteBudget}
        />
        <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-4 text-sm">
          <p className="font-medium">How quadratic voting works</p>
          <p className="text-muted-foreground">
            Casting <em>n</em> votes on one project costs <em>n²</em> credits, so strong preferences
            get expensive and a loud minority can't dominate.
          </p>
          <p className="text-muted-foreground">
            With {pluralize(d.voteBudget || 0, "credit")}, a voter could put{" "}
            <span className="text-foreground font-medium tabular-nums">{maxVotes}</span> votes on a
            single project, or 1 vote on each of{" "}
            <span className="text-foreground font-medium tabular-nums">{d.voteBudget || 0}</span>{" "}
            projects.
          </p>
        </div>
      </div>
    </FieldGroup>
  );
}

function ReviewStep({ d, set, onEdit }: { d: Draft; set: SetFn; onEdit: (step: number) => void }) {
  const dt = (v: string) => (v ? formatDateTime(new Date(v)) : "—");
  const accessLabel = {
    authenticated: "Signed-in users",
    email: "Verified email",
    open: "Open link",
  }[d.votingAccess];
  const groups: { step: number; title: string; rows: [string, React.ReactNode][] }[] = [
    {
      step: 0,
      title: "Basics",
      rows: [
        ["Name", d.name],
        [
          "URL",
          <span key="u" className="font-mono">
            /e/{d.slug}
          </span>,
        ],
        ["Tagline", d.tagline || "—"],
        ["Format", `${d.mode}${d.mode !== "online" && d.location ? ` · ${d.location}` : ""}`],
      ],
    },
    {
      step: 1,
      title: "Schedule",
      rows: [
        ["Submissions open", d.submissionsOpen ? dt(d.submissionsOpen) : "Immediately"],
        ["Submission deadline", dt(d.submissionsClose)],
        ["Judging closes", dt(d.judgingClose)],
        [
          "Voting",
          d.votingOpen || d.votingClose
            ? `${dt(d.votingOpen)} → ${dt(d.votingClose)}`
            : "No community vote",
        ],
      ],
    },
    {
      step: 2,
      title: "Tracks",
      rows: [["Tracks", d.tracks.length ? d.tracks.join(", ") : "None"]],
    },
    {
      step: 3,
      title: "Rules & settings",
      rows: [
        ["Max team size", d.maxTeamSize],
        ["Reviews per project", d.reviewsPerProject],
        [
          "Voting access",
          d.votingAccess === "email"
            ? `${accessLabel} (${parseDomains(d.domains).join(", ")})`
            : accessLabel,
        ],
        ["Vote credits", d.voteBudget],
      ],
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{g.title}</p>
            <Button variant="ghost" size="xs" onClick={() => onEdit(g.step)}>
              Edit
            </Button>
          </div>
          <dl className="divide-y rounded-lg border text-sm">
            {g.rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[160px_1fr] gap-3 px-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">
        A default four-criterion rubric (impact, execution, innovation, presentation) is added —
        tune it on the Rubric page.
      </p>
      <FieldLabel htmlFor="publish">
        <Field orientation="horizontal">
          <Checkbox
            id="publish"
            checked={d.publish}
            onCheckedChange={(c) => set("publish", Boolean(c))}
          />
          <FieldContent>
            <FieldTitle>Publish immediately</FieldTitle>
            <FieldDescription>
              Otherwise the event is created as a draft that only organizers can see.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>
    </div>
  );
}
