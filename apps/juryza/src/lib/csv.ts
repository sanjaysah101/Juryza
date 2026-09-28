/**
 * Minimal, dependency-free CSV writer (RFC 4180).
 *
 * Fields containing a comma, quote or newline are quoted with internal quotes
 * doubled. Cells that a spreadsheet would execute as a formula (leading `=`,
 * `+`, `-`, `@`, tab or CR) are prefixed with an apostrophe — exports are
 * opened in Excel by organizers, and project titles are attacker-controlled.
 */

function escapeField(value: unknown): string {
  let s =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
