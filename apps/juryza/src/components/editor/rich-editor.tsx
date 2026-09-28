"use client";

import { useState } from "react";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Heading2,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";

import { cn } from "@juryza/ui/lib/utils";

import type { RichDoc } from "@/lib/db/schema";

import { editorExtensions } from "./extensions";
import { SlashCommand } from "./slash-command";

/**
 * A Notion-style block editor.
 *
 *  - Type "/" for the block menu (headings, lists, to-dos, quotes, code, images…)
 *  - Markdown shortcuts work as you type: "# ", "- ", "1. ", "[] ", "> ", "```"
 *  - Select text for the floating formatting toolbar (bold, italic, link, …)
 *
 * The value is ProseMirror JSON (`RichDoc`), stored as-is by the API.
 */
export function RichEditor({
  value,
  onChange,
  placeholder = "Write something, or press / for blocks…",
  className,
  autofocus = false,
}: {
  value: RichDoc | null | undefined;
  onChange: (doc: RichDoc) => void;
  placeholder?: string;
  className?: string;
  autofocus?: boolean;
}) {
  const editor = useEditor({
    extensions: editorExtensions(placeholder, [SlashCommand]),
    content: (value ?? { type: "doc", content: [{ type: "paragraph" }] }) as JSONContent,
    immediatelyRender: false,
    autofocus,
    editorProps: {
      attributes: { class: cn("rich-content rich-editable focus:outline-none", className) },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichDoc),
  });

  if (!editor) {
    return (
      <div className={cn("rich-content text-muted-foreground min-h-40", className)}>
        Loading editor…
      </div>
    );
  }
  return (
    <div className="relative">
      <FormattingMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function FormattingMenu({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      heading: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
    }),
  });

  const applyLink = () => {
    const href = url.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: /^[a-z]+:/i.test(href) ? href : `https://${href}` })
        .run();
    setLinking(false);
  };

  const btn = (
    active: boolean,
    label: string,
    onClick: () => void,
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "hover:bg-accent grid size-7 place-items-center rounded-md transition-colors",
        active && "bg-accent text-primary"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, from, to }) =>
        from !== to && !e.isActive("codeBlock") && !e.isActive("image")
      }
      className="bg-popover text-popover-foreground z-50 flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
    >
      {linking ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the field appears because the user asked to add a link
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setLinking(false)}
            placeholder="Paste a link…"
            className="bg-background h-7 w-56 rounded-md border px-2 text-xs outline-none"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-7 rounded-md px-2 text-xs font-medium"
          >
            Apply
          </button>
        </form>
      ) : (
        <>
          {btn(
            state.heading,
            "Heading",
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            Heading2
          )}
          <span className="bg-border mx-0.5 h-4 w-px" />
          {btn(state.bold, "Bold (⌘B)", () => editor.chain().focus().toggleBold().run(), Bold)}
          {btn(
            state.italic,
            "Italic (⌘I)",
            () => editor.chain().focus().toggleItalic().run(),
            Italic
          )}
          {btn(
            state.underline,
            "Underline (⌘U)",
            () => editor.chain().focus().toggleUnderline().run(),
            Underline
          )}
          {btn(
            state.strike,
            "Strikethrough",
            () => editor.chain().focus().toggleStrike().run(),
            Strikethrough
          )}
          {btn(state.code, "Inline code", () => editor.chain().focus().toggleCode().run(), Code)}
          {btn(
            state.highlight,
            "Highlight",
            () => editor.chain().focus().toggleHighlight().run(),
            Highlighter
          )}
          {btn(
            state.link,
            "Link",
            () => {
              setUrl((editor.getAttributes("link").href as string) ?? "");
              setLinking(true);
            },
            Link2
          )}
          <span className="bg-border mx-0.5 h-4 w-px" />
          {btn(
            state.bullet,
            "Bulleted list",
            () => editor.chain().focus().toggleBulletList().run(),
            List
          )}
          {btn(
            state.task,
            "To-do list",
            () => editor.chain().focus().toggleTaskList().run(),
            ListChecks
          )}
          {btn(state.quote, "Quote", () => editor.chain().focus().toggleBlockquote().run(), Quote)}
        </>
      )}
    </BubbleMenu>
  );
}
