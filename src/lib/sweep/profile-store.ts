/**
 * Recovering paid profile readings out of whatever shape a research file
 * happens to have (docs/WORKPLAN.md B10, Track B).
 *
 * Pure, so it can be tested without a disk or an API. The scripts own the file
 * walking; this owns the question "which objects in here are user profiles".
 *
 * ---------------------------------------------------------------------------
 * Why this is shape-agnostic rather than reading a known key.
 *
 * A user object costs $0.010 and cannot be re-obtained as the same reading at
 * any price — a follower count and a bio are observations of a moment, the same
 * argument `docs/DATA.md §5` makes about view counts. The files in `research/`
 * were written by different runs at different times and put those objects in at
 * least three places: `users` at the top level, `includes.users` beside a tweet
 * payload, and nested inside a sweep report's candidate list.
 *
 * A reader that knows only one of those shapes silently loses the others, and
 * the loss shows up as a bill rather than an error. So this walks the whole
 * structure and recognises a profile by its fields instead.
 * ---------------------------------------------------------------------------
 */

/** The fields this project actually reads off a profile. */
export interface PaidProfile {
  id: string;
  username: string;
  name?: string;
  description?: string;
  location?: string;
  verified_type?: string;
  public_metrics?: { followers_count?: number };
  /** The day the reading was taken, where the writer recorded it. */
  observed_at?: string;
}

/**
 * Every user object anywhere in a parsed JSON value.
 *
 * A profile is recognised by carrying both a string `id` and a string
 * `username` — the pair no other object in these payloads has. Tweets carry
 * `id` with `text` or `author_id`; only a user carries `username`.
 */
export function collectUserObjects(value: unknown): PaidProfile[] {
  const found: PaidProfile[] = [];

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    if (typeof record.id === "string" && typeof record.username === "string") {
      found.push(record as unknown as PaidProfile);
      // A profile holds no nested profiles; descending further would only find
      // its own `public_metrics`.
      return;
    }
    for (const nested of Object.values(record)) visit(nested);
  };

  visit(value);
  return found;
}

/**
 * Folds profiles into a store keyed by account id, newest reading winning.
 *
 * Newest rather than first because a later reading is a later observation, and
 * a stale follower count presented as current is the failure `docs/DATA.md §5`
 * warns about. A profile with no `observed_at` never displaces one that has a
 * date — an undated reading cannot be shown to be the more recent of the two.
 */
export function mergeProfiles(
  store: Map<string, PaidProfile>,
  incoming: readonly PaidProfile[],
): { added: number; replaced: number } {
  let added = 0;
  let replaced = 0;

  for (const profile of incoming) {
    if (!profile?.id || !profile?.username) continue;
    const held = store.get(profile.id);
    if (!held) {
      store.set(profile.id, profile);
      added += 1;
      continue;
    }
    if (isNewerReading(profile, held)) {
      store.set(profile.id, profile);
      replaced += 1;
    }
  }
  return { added, replaced };
}

function isNewerReading(candidate: PaidProfile, held: PaidProfile): boolean {
  if (!candidate.observed_at) return false;
  if (!held.observed_at) return true;
  return candidate.observed_at > held.observed_at;
}
