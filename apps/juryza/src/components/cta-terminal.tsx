"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Check, Copy, ExternalLink, Server } from "lucide-react";

const REPO_URL = "https://github.com/sanjaysah101/juryza";

const LINES = [
  { prompt: true, text: `git clone ${REPO_URL} && cd juryza` },
  { prompt: true, text: "docker compose up" },
  { prompt: false, text: "✓ postgres ready · schema pushed · fixtures seeded" },
  { prompt: false, text: "✓ portal on http://localhost:8080" },
] as const;

const COPY_TEXT = `git clone ${REPO_URL} && cd juryza\ndocker compose up`;

/** Character-by-character typewriter that respects prefers-reduced-motion. */
function useTypewriter(active: boolean) {
  const [displayed, setDisplayed] = useState<string[]>([]);

  useEffect(() => {
    if (!active) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplayed(LINES.map((l) => l.text));
      return;
    }

    let lineIdx = 0;
    let charIdx = 0;
    setDisplayed([]);

    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const line = LINES[lineIdx];
      if (!line) return;

      setDisplayed((prev) => {
        const next = [...prev];
        next[lineIdx] = line.text.slice(0, charIdx + 1);
        return next;
      });

      charIdx++;

      if (charIdx >= line.text.length) {
        lineIdx++;
        charIdx = 0;
        if (lineIdx < LINES.length) {
          timer = setTimeout(tick, lineIdx >= 2 ? 80 : 320);
          return;
        }
        return;
      }

      const delay = line.prompt ? 30 : 20;
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [active]);

  return displayed;
}

export function CtaTerminal() {
  const [copied, setCopied] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lines = useTypewriter(hasEntered);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(COPY_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — silently no-op */
    }
  }, []);

  return (
    <div
      ref={ref}
      className="bg-foreground/90 text-background rounded-xl p-5 font-mono text-sm shadow-2xl ring-1 ring-black/10"
    >
      {/* Terminal chrome */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-background/50 flex items-center gap-1.5 text-xs">
          <Server className="size-3.5" />
          terminal
        </span>
        <div className="flex items-center gap-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-background/50 hover:text-background/90 flex items-center gap-1 text-xs transition-colors"
            aria-label="View source on GitHub"
          >
            <ExternalLink className="size-3" />
            <span>github</span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="text-background/50 hover:text-background/90 flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
            aria-label={copied ? "Copied!" : "Copy commands"}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-green-400" />
                <span className="text-green-400">copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal lines — only render lines that have started appearing */}
      <div className="space-y-1.5" aria-live="polite">
        {LINES.map((line, i) => {
          const text = lines[i];
          if (text === undefined) return null;

          const isTyping = line.prompt && text.length < line.text.length;

          return (
            <p key={line.text} className={line.prompt ? "text-background" : "text-background/55"}>
              {line.prompt && <span className="text-background/35 mr-2 select-none">$</span>}
              {line.prompt ? (
                <>
                  {text}
                  {isTyping && (
                    <span
                      className="ml-px inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-70"
                      aria-hidden
                    />
                  )}
                </>
              ) : (
                <span
                  style={{
                    opacity: text ? 1 : 0,
                    transition: "opacity 0.25s ease",
                  }}
                >
                  {line.text}
                </span>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}
