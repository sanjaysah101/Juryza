import { customAlphabet, nanoid } from "nanoid";

/**
 * Prefixed, URL-safe id generators.
 *
 * Domain rows use a short human-scannable prefix (`evt_`, `prj_`, `tm_`, …) so a
 * value read from a log or a CSV tells you what it is. Seeded fixture rows keep
 * their original ids from `fixtures.json`; only newly created rows use these.
 */
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const short = customAlphabet(alphabet, 12);

export const id = {
  event: () => `evt_${short()}`,
  track: () => `trk_${short()}`,
  prize: () => `prz_${short()}`,
  criterion: () => `crit_${short()}`,
  team: () => `tm_${short()}`,
  project: () => `prj_${short()}`,
  assignment: () => `asg_${short()}`,
  score: () => `scr_${short()}`,
  vote: () => `vote_${short()}`,
  pairwise: () => `pw_${short()}`,
  comment: () => `cmt_${short()}`,
  audit: () => `log_${short()}`,
  apiToken: () => `tok_${short()}`,
};

/** Opaque, high-entropy secrets: bearer tokens and team invite links. */
export const secretToken = () => nanoid(32);
