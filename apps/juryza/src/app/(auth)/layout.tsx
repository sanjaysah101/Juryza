import { CheckCircle2 } from "lucide-react";

import { Logo } from "@/components/brand";
import { EventCover } from "@/components/event-bits";

const POINTS = [
  "Judges never see each other's scores — enforced by the API, not the UI.",
  "Harsh and generous judges are evened out, and the maths is published.",
  "Community voting that a loud minority cannot stuff.",
];

/** Split-screen layout for sign-in, sign-up and password reset. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <EventCover hue={275} className="hidden text-white lg:flex">
        <div className="relative flex flex-1 flex-col justify-end gap-6 p-12">
          <blockquote className="max-w-md text-2xl leading-snug font-medium text-balance">
            “The portal that enforced its own rules in the backend, started with one command, and
            read like software somebody intends to maintain.”
          </blockquote>
          <ul className="flex max-w-md flex-col gap-3 text-sm text-white/85">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </EventCover>
    </div>
  );
}
