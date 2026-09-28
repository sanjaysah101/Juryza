import { describe, expect, test } from "bun:test";

import type { RichDoc } from "@/lib/db/schema";
import { docToText, isEmptyDoc, parseRichDoc, textToDoc } from "@/lib/rich-text";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Overview" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", marks: [{ type: "bold" }], text: "world" },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }],
        },
      ],
    },
    { type: "paragraph" },
  ],
} as RichDoc;

describe("docToText", () => {
  test("joins inline text and puts blocks on their own lines", () => {
    expect(docToText(doc)).toBe("Overview\nHello world\none\n\ntwo");
  });

  test("handles missing documents and truncates", () => {
    expect(docToText(null)).toBe("");
    expect(docToText(undefined)).toBe("");
    expect(docToText(doc, 5)).toBe("Overv");
  });
});

describe("textToDoc", () => {
  test("turns blank-line separated text into paragraphs", () => {
    expect(textToDoc("First para\n\n  Second para  \n\n\n")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First para" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second para" }] },
      ],
    } as RichDoc);
  });

  test("empty text gives one empty paragraph", () => {
    expect(textToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] } as RichDoc);
    expect(textToDoc(null)).toEqual(textToDoc(""));
  });

  test("round-trips through docToText", () => {
    expect(docToText(textToDoc("a\n\nb"))).toBe("a\nb");
  });
});

describe("isEmptyDoc", () => {
  test("is true for nothing or whitespace-only documents", () => {
    expect(isEmptyDoc(null)).toBe(true);
    expect(isEmptyDoc(textToDoc(""))).toBe(true);
    expect(
      isEmptyDoc({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }],
      } as RichDoc)
    ).toBe(true);
    expect(isEmptyDoc(doc)).toBe(false);
  });
});

describe("parseRichDoc", () => {
  test("parses serialized JSON RichDoc", () => {
    const serialized = JSON.stringify(doc);
    expect(parseRichDoc(serialized)).toEqual(doc);
  });

  test("converts plain text to RichDoc", () => {
    expect(parseRichDoc("Hello world")).toEqual(textToDoc("Hello world"));
  });

  test("handles empty or nullish values", () => {
    expect(parseRichDoc(null)).toEqual(textToDoc(""));
    expect(parseRichDoc("")).toEqual(textToDoc(""));
  });

  test("passes RichDoc through unchanged", () => {
    expect(parseRichDoc(doc)).toEqual(doc);
  });
});
