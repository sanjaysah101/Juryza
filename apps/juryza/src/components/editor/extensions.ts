import type { Extensions } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

/**
 * The editor's document schema. The read-only renderer uses exactly the same
 * list, so anything that can be written can be shown — and nothing else can:
 * unknown nodes and attributes in stored JSON are dropped by the schema, which
 * is what keeps user content from ever reaching the page as raw HTML.
 */

const safeUrl = (url: string) => /^(https?:|mailto:)/i.test(url.trim());

export function baseExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
        isAllowedUri: (url) => safeUrl(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Typography,
    Image.configure({ inline: false, allowBase64: false }).extend({
      // Only http(s) images; anything else renders as nothing.
      renderHTML({ HTMLAttributes }) {
        const src =
          typeof HTMLAttributes.src === "string" && /^https?:/i.test(HTMLAttributes.src)
            ? HTMLAttributes.src
            : "";
        return ["img", { ...HTMLAttributes, src, loading: "lazy" }];
      },
    }),
  ];
}

export function editorExtensions(placeholder: string, extra: Extensions = []): Extensions {
  return [
    ...baseExtensions(),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading" ? `Heading ${node.attrs.level}` : placeholder,
      includeChildren: false,
    }),
    ...extra,
  ];
}
