"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import { type Editor, Extension, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Type,
} from "lucide-react";

import { cn } from "@juryza/ui/lib/utils";

/**
 * Notion-style "/" command menu. Type "/" at any point, filter by typing, pick
 * with ↑ ↓ and Enter (or click). Built on Tiptap's Suggestion utility.
 */

interface CommandItem {
  title: string;
  description: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (editor: Editor, range: Range) => void;
}

const ITEMS: CommandItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    keywords: "paragraph p",
    icon: Type,
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    keywords: "h1 title",
    icon: Heading1,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    keywords: "h2 subtitle",
    icon: Heading2,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    keywords: "h3",
    icon: Heading3,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(),
  },
  {
    title: "Bulleted list",
    description: "A simple list",
    keywords: "ul unordered bullet",
    icon: List,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "A list with numbers",
    keywords: "ol ordered number",
    icon: ListOrdered,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Track tasks with checkboxes",
    keywords: "todo task checkbox",
    icon: ListChecks,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Call out a quotation",
    keywords: "blockquote citation",
    icon: Quote,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Monospaced code",
    keywords: "pre snippet",
    icon: Code2,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Highlight",
    description: "Mark important text",
    keywords: "mark yellow",
    icon: Highlighter,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleHighlight().run(),
  },
  {
    title: "Divider",
    description: "Separate sections",
    keywords: "hr rule line",
    icon: Minus,
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    title: "Image",
    description: "Embed an image by URL",
    keywords: "picture photo screenshot",
    icon: ImageIcon,
    run: (e, r) => {
      const src = window.prompt("Image URL (https://…)");
      e.chain().focus().deleteRange(r).run();
      if (src && /^https?:\/\//i.test(src)) e.chain().focus().setImage({ src }).run();
    },
  },
];

function filterItems(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return ITEMS;
  return ITEMS.filter((i) => `${i.title} ${i.keywords}`.toLowerCase().includes(q));
}

interface MenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const CommandMenu = forwardRef<MenuHandle, SuggestionProps<CommandItem, CommandItem>>(
  function CommandMenu({ items, command }, ref) {
    const [active, setActive] = useState(0);
    useEffect(() => setActive(0), []);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (event.key === "ArrowDown") {
          setActive((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "ArrowUp") {
          setActive((i) => (i - 1 + items.length) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          const item = items[active];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-popover text-muted-foreground w-72 rounded-xl border p-3 text-sm shadow-lg">
          No matching blocks
        </div>
      );
    }
    return (
      <div
        className="bg-popover text-popover-foreground w-72 overflow-hidden rounded-xl border p-1 shadow-lg"
        role="listbox"
      >
        <p className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-medium">Blocks</p>
        <div className="max-h-80 overflow-y-auto">
          {items.map((item, i) => (
            <button
              key={item.title}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left",
                i === active && "bg-accent text-accent-foreground"
              )}
            >
              <span className="bg-background grid size-9 shrink-0 place-items-center rounded-md border">
                <item.icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground truncate text-xs">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  const menuHeight = el.offsetHeight || 320;
  const below = rect.bottom + 8;
  const top =
    below + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 8) : below;
  el.style.top = `${top}px`;
  el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
}

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion<CommandItem, CommandItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<
            MenuHandle,
            SuggestionProps<CommandItem, CommandItem>
          > | null = null;
          let host: HTMLDivElement | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(CommandMenu, { props, editor: props.editor });
              host = document.createElement("div");
              host.style.position = "fixed";
              host.style.zIndex = "60";
              host.appendChild(renderer.element);
              document.body.appendChild(host);
              requestAnimationFrame(() => host && place(host, props.clientRect?.()));
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              if (host) place(host, props.clientRect?.());
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                host?.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              host?.remove();
              renderer?.destroy();
              host = null;
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
