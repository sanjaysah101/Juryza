import { describe, expect, test } from "bun:test";

import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  test("writes a header and rows with CRLF line endings", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, "x"],
          [2, "y"],
        ]
      )
    ).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  test("quotes fields with commas, quotes and newlines, doubling inner quotes", () => {
    expect(toCsv(["v"], [["a,b"], ['say "hi"'], ["line\nbreak"], ["cr\rhere"]])).toBe(
      'v\r\n"a,b"\r\n"say ""hi"""\r\n"line\nbreak"\r\n"cr\rhere"\r\n'
    );
  });

  test("empty values, dates and booleans", () => {
    const at = new Date("2026-10-01T17:00:00.000Z");
    expect(toCsv(["a", "b", "c", "d"], [[null, undefined, at, true]])).toBe(
      "a,b,c,d\r\n,,2026-10-01T17:00:00.000Z,true\r\n"
    );
  });

  test("neutralizes spreadsheet formulas in text cells", () => {
    const out = toCsv(
      ["t"],
      [['=HYPERLINK("http://evil")'], ["+1"], ["-cmd"], ["@SUM(A1)"], ["\tx"]]
    );
    expect(out.split("\r\n").slice(1, -1)).toEqual([
      '"\'=HYPERLINK(""http://evil"")"',
      "'+1",
      "'-cmd",
      "'@SUM(A1)",
      "'\tx",
    ]);
  });

  test("quotes a neutralized formula that also contains a comma", () => {
    expect(toCsv(["t"], [["=A1,B1"]])).toBe('t\r\n"\'=A1,B1"\r\n');
  });

  test("leaves real numbers alone, including negatives", () => {
    expect(toCsv(["n"], [[-5], [3.25]])).toBe("n\r\n-5\r\n3.25\r\n");
  });
});
