/** Display formatting shared by every page. Client- and server-safe. */

type D = Date | string | number | null | undefined;
const toDate = (d: D) => (d === null || d === undefined ? null : new Date(d));

export function formatDate(d: D, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const x = toDate(d);
  return x ? new Intl.DateTimeFormat("en", opts).format(x) : "—";
}

export function formatDateTime(d: D) {
  return formatDate(d, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRange(a: D, b: D) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x) return formatDate(y);
  if (!y) return formatDate(x);
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).formatRange(x, y);
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "in 3 days", "2 hours ago". */
export function relativeTime(d: D, now = Date.now()) {
  const x = toDate(d);
  if (!x) return "—";
  const seconds = Math.round((x.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, "second");
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const cleaned = name.replace(/^[^a-zA-Z0-9]+/, "").trim();
  if (!cleaned) return "?";

  // Check if multiple words or separated by dots/dashes/underscores
  const parts = cleaned.split(/[\s_\-.]+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
  }

  const single = parts[0] ?? "";
  // Check for PascalCase or camelCase like "PatParticipant" or "JohnDoe"
  const caps = single.match(/[A-Z]/g);
  if (caps && caps.length >= 2) {
    return (caps[0] + caps[1]).toUpperCase();
  }

  return (single[0] ?? "?").toUpperCase();
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** Stable 0–360 hue from any string, for project/team covers. */
export function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
