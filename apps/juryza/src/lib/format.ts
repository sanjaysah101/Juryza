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
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
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
