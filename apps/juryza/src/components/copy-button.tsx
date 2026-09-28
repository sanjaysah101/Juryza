"use client";

import { useEffect, useState } from "react";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@juryza/ui/components/ui/button";

/** Copies `value` to the clipboard and confirms inline for a moment. */
export function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Couldn't access the clipboard — select the text instead");
    }
  };

  const icon = copied ? <Check className="text-success" /> : <Copy />;
  if (iconOnly) {
    return (
      <Button type="button" size="icon-sm" variant="ghost" aria-label={label} onClick={copy}>
        {icon}
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy}>
      {icon} {copied ? "Copied" : label}
    </Button>
  );
}
