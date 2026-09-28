"use client";

import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@juryza/ui/components/ui/skeleton";
import { cn } from "@juryza/ui/lib/utils";

import { LogoMark } from "@/components/brand";
import { type GalleryResponse, ProjectCard } from "@/components/project-card";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";

/**
 * The embeddable gallery widget (`/embed/<slug>`), loaded in an iframe by
 * `/embed.js`. Query string: `?theme=light|dark`, `?limit=` (default 12, max
 * 48), `?transparent=1` to let the host page's background show through. It
 * reports its height to the parent window so the iframe can size itself.
 */

export default function EmbedPage() {
  return (
    <Suspense fallback={null}>
      <EmbedGallery />
    </Suspense>
  );
}

function EmbedGallery() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const theme = search.get("theme");
  const transparent = search.get("transparent") === "1";
  const limit = Math.min(48, Math.max(1, Number.parseInt(search.get("limit") ?? "12", 10) || 12));
  const root = useRef<HTMLDivElement>(null);

  // Force the requested theme inside the frame, without touching the saved site preference.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (theme === "dark" || theme === "light") {
      html.classList.toggle("dark", theme === "dark");
      html.classList.toggle("light", theme === "light");
      html.style.colorScheme = theme;
    }
    if (transparent) {
      document.body.style.background = "transparent";
      html.style.background = "transparent";
    }
  }, [theme, transparent]);

  const { data, isLoading } = useQuery({
    queryKey: ["gallery", slug, ""],
    queryFn: () => api.get<GalleryResponse>(`/api/events/${slug}/projects`),
  });

  // Tell the embedding page how tall we are.
  useEffect(() => {
    const el = root.current;
    if (!el || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "juryza:embed-height", slug, height: Math.ceil(el.getBoundingClientRect().height) },
        "*"
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slug]);

  const shown = data?.projects.slice(0, limit) ?? [];
  const more = (data?.count ?? 0) - shown.length;
  const galleryUrl = `/e/${slug}/projects`;

  return (
    <div ref={root} className={cn("flex flex-col gap-4 p-4", !transparent && "bg-background")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold tracking-tight">
            {data?.event.name ?? "Projects"}
          </span>
          <span className="text-muted-foreground text-xs">
            {data ? pluralize(data.count, "submitted project") : "Loading…"}
          </span>
        </div>
        <a
          href={galleryUrl}
          target="_blank"
          rel="noopener"
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm font-medium"
        >
          View all <ArrowUpRight className="size-4" />
        </a>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: Math.min(limit, 8) }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No projects submitted yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              href={`/e/${slug}/projects/${p.id}`}
              target="_blank"
            />
          ))}
        </div>
      )}

      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        {more > 0 ? (
          <a href={galleryUrl} target="_blank" rel="noopener" className="hover:text-foreground">
            +{more} more on the full gallery
          </a>
        ) : (
          <span />
        )}
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="hover:text-foreground flex items-center gap-1.5"
        >
          <LogoMark className="size-4 rounded [&_svg]:size-2.5" /> Powered by Juryza
        </a>
      </div>
    </div>
  );
}
