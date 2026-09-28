"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "@juryza/ui/lib/utils";

import type { RichDoc } from "@/lib/db/schema";
import { isEmptyDoc } from "@/lib/rich-text";

import { baseExtensions } from "./extensions";

/**
 * Read-only rendering of an editor document, through the same schema the
 * editor uses (so unknown or unsafe nodes simply do not render).
 */
export function RichContent({
  doc,
  className,
  empty = null,
}: {
  doc: RichDoc | null | undefined;
  className?: string;
  empty?: React.ReactNode;
}) {
  const editor = useEditor(
    {
      extensions: baseExtensions(),
      content: (doc ?? undefined) as JSONContent | undefined,
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: cn("rich-content", className) } },
    },
    [doc]
  );
  if (isEmptyDoc(doc)) return <>{empty}</>;
  if (!editor) return <div className={cn("rich-content", className)} />;
  return <EditorContent editor={editor} />;
}
