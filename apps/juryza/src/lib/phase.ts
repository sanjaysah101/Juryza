/**
 * An event's lifecycle, derived from its dates. Pure and client-safe, so the
 * server's deadline checks and the UI's timeline agree by construction.
 *
 *   upcoming → submissions → judging → voting → (awaiting results) → results
 *
 * Voting can overlap judging; the phase reports the most public-facing one.
 */

export type Phase = "upcoming" | "submissions" | "judging" | "voting" | "results";

export interface EventDates {
  submissionsOpen: Date | string | null;
  submissionsClose: Date | string;
  judgingClose?: Date | string | null;
  votingOpen: Date | string | null;
  votingClose: Date | string | null;
  resultsPublished: boolean;
}

const t = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);

export function submissionsAreOpen(e: EventDates, now = Date.now()): boolean {
  const open = t(e.submissionsOpen);
  const close = t(e.submissionsClose) ?? 0;
  return (open === null || now >= open) && now < close;
}

/** Voting needs an explicit window; an event without one has no community vote. */
export function votingIsOpen(e: EventDates, now = Date.now()): boolean {
  const open = t(e.votingOpen);
  const close = t(e.votingClose);
  if (open === null && close === null) return false;
  return (open === null || now >= open) && (close === null || now < close);
}

export function hasVoting(e: EventDates): boolean {
  return t(e.votingOpen) !== null || t(e.votingClose) !== null;
}

export function phaseOf(e: EventDates, now = Date.now()): Phase {
  if (e.resultsPublished) return "results";
  const open = t(e.submissionsOpen);
  if (open !== null && now < open) return "upcoming";
  if (submissionsAreOpen(e, now)) return "submissions";
  if (votingIsOpen(e, now)) return "voting";
  return "judging";
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "Upcoming",
  submissions: "Submissions open",
  judging: "Judging",
  voting: "Community voting",
  results: "Results published",
};

/** Ordered milestones for a timeline view. */
export function milestones(e: EventDates) {
  const list: { key: string; label: string; at: Date | null }[] = [
    {
      key: "open",
      label: "Submissions open",
      at: e.submissionsOpen ? new Date(e.submissionsOpen) : null,
    },
    { key: "close", label: "Submission deadline", at: new Date(e.submissionsClose) },
    {
      key: "judging",
      label: "Judging closes",
      at: e.judgingClose ? new Date(e.judgingClose) : null,
    },
    { key: "voteOpen", label: "Voting opens", at: e.votingOpen ? new Date(e.votingOpen) : null },
    {
      key: "voteClose",
      label: "Voting closes",
      at: e.votingClose ? new Date(e.votingClose) : null,
    },
  ];
  return list
    .filter((m): m is { key: string; label: string; at: Date } => m.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
