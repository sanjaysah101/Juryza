import type { RichDoc } from "@/lib/db/schema";

/**
 * Helpers for editor documents (ProseMirror JSON). Client- and server-safe.
 */

interface Node {
  type?: string;
  text?: string;
  content?: Node[];
}

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "codeBlock",
  "callout",
]);

/** Plain text of a document, one line per block — for search, cards and similarity. */
export function docToText(doc: RichDoc | null | undefined, maxLength = 20_000): string {
  if (!doc) return "";
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.text) out.push(n.text);
    for (const c of n.content ?? []) walk(c);
    if (n.type && BLOCKS.has(n.type)) out.push("\n");
  };
  walk(doc as Node);
  return out
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

/** A document containing the given paragraphs of plain text. */
export function textToDoc(text: string | null | undefined): RichDoc {
  const paragraphs = (text ?? "").split(/\n{2,}/).filter((p) => p.trim());
  return {
    type: "doc",
    content: paragraphs.length
      ? paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p.trim() }] }))
      : [{ type: "paragraph" }],
  };
}

export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  return docToText(doc).length === 0;
}

/** Parses a string (ProseMirror JSON or plain text) or returns a RichDoc as-is. */
export function parseRichDoc(value: string | RichDoc | null | undefined): RichDoc {
  if (!value) return textToDoc("");
  if (typeof value === "object" && value.type === "doc") {
    return value as RichDoc;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type === "doc") {
          return parsed as RichDoc;
        }
      } catch {}
    }
    return textToDoc(value);
  }
  return textToDoc("");
}
