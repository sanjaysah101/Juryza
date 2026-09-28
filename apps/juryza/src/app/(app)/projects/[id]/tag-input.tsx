"use client";

import { useState } from "react";

import { X } from "lucide-react";

import { cn } from "@juryza/ui/lib/utils";

/**
 * Inline tag entry: type and press Enter (or comma) to add, Backspace on an
 * empty field removes the last tag, × removes one. Case-insensitive de-dupe.
 * Shared by the project editor (tech tags) and profile settings (skills).
 */
export function TagInput({
  value,
  onChange,
  max = 12,
  maxLength = 30,
  placeholder = "Add a tag…",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState("");
  const full = value.length >= max;

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, maxLength);
    if (!tag || full) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setText("");
      return;
    }
    onChange([...value, tag]);
    setText("");
  };

  return (
    <div className={cn("flex min-h-8 flex-wrap items-center gap-1.5", className)}>
      {value.map((tag) => (
        <span
          key={tag}
          className="bg-secondary text-secondary-foreground inline-flex h-6 items-center gap-1 rounded-md pr-1 pl-2 text-xs font-medium"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="hover:bg-foreground/10 focus-visible:ring-ring/50 grid size-4 place-items-center rounded-sm outline-none focus-visible:ring-2"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && !full && (
        <input
          value={text}
          aria-label={ariaLabel}
          maxLength={maxLength}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(text)}
          placeholder={value.length ? "" : placeholder}
          className="placeholder:text-muted-foreground h-7 min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      )}
      {full && !disabled && <span className="text-muted-foreground text-xs">Max {max}</span>}
    </div>
  );
}
