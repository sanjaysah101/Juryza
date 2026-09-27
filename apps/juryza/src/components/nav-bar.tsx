"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@juryza/ui/components/ui/button";
import { ThemeToggle } from "@juryza/ui/theme/theme-toggle";

import { auth } from "@/lib/auth";

/**
 * Top navigation. Renders role-aware links from the session: everyone sees the
 * gallery; participants get "My projects" and "Teams"; judges get the judge
 * console; organizers/admins get the dashboard. These are convenience links —
 * the real authorization is enforced in the backend on every route, so hiding a
 * link never stands in for a permission check.
 */
export function NavBar() {
  const { status, user } = auth.useSession();
  const router = useRouter();
  const role = user?.role ?? "visitor";
  const isJudge = role === "judge";
  const isOrganizer = role === "organizer" || role === "admin";
  const isParticipant = role === "participant" || isOrganizer;

  return (
    <header className="border-b border-border/60 bg-background/80 sticky top-0 z-40 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="mr-4 flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs font-bold">
            J
          </span>
          Juryza
        </Link>

        <nav className="flex items-center gap-0.5 text-sm">
          <NavLink href="/gallery">Gallery</NavLink>
          <NavLink href="/vote">Vote</NavLink>
          <NavLink href="/results">Results</NavLink>
          {isParticipant && <NavLink href="/dashboard">My projects</NavLink>}
          {isParticipant && <NavLink href="/teams">Teams</NavLink>}
          {isJudge && <NavLink href="/judge">Judge console</NavLink>}
          {isOrganizer && <NavLink href="/organizer">Organizer</NavLink>}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {user?.name} · <span className="capitalize">{role}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await auth.signOut();
                  router.push("/");
                  router.refresh();
                }}
              >
                Sign out
              </Button>
            </div>
          ) : status === "unauthenticated" ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Sign in
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
                Sign up
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 transition-colors"
    >
      {children}
    </Link>
  );
}
