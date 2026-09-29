"use client";

import { useEffect, useRef, useState } from "react";

import { formatNumber } from "@/lib/format";

/** Counts up from 0 → target once the element enters the viewport. */
export function AnimatedCounter({ value }: { value: number }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        observer.disconnect();

        if (prefersReduced || value === 0) {
          setCurrent(value);
          return;
        }

        const duration = 1200;
        const startTime = performance.now();

        const step = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out cubic
          const eased = 1 - (1 - progress) ** 3;
          setCurrent(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{formatNumber(current)}</span>;
}
