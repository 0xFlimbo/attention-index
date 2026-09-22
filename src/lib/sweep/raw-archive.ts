/**
 * Where a billed API response goes the moment it arrives.
 *
 * ---------------------------------------------------------------------------
 * **Why this is a module and not a convention.**
 *
 * `research/README.md` has always said that paid data is not disposable, and
 * both sweep scripts have always written their main payload there. That was
 * still not enough, twice over:
 *
 * - **Some billed calls were never covered at all.** `sweep:mentions` sizes a
 *   window with `counts` on *every* run — the default mode, the one that runs
 *   most often — and printed the result without keeping it.
 * - **Ad-hoc probes had ad-hoc storage.** On 2026-09-21 five hand-assembled
 *   `curl` probes — two `counts` calls and two `/2/news/search` calls, $0.12 —
 *   spent hours in a session scratchpad that gets wiped, while the README told
 *   anyone reading it that this could not happen.
 *
 * A convention that each caller re-implements is a convention each caller can
 * forget. This makes the archive a function you call with the response, so the
 * only way to skip it is to delete the call rather than to never write it.
 *
 * **The rule it enforces: persist before you parse.** A raw body is written
 * before anything reads a field off it, because a request that was
 * misunderstood and a field that is genuinely absent look identical once the
 * response has been parsed away — and the X API answers an unknown field name
 * with HTTP 200 and silence (`docs/X-API.md §15–§16`).
 * ---------------------------------------------------------------------------
 */

/** One archived response: what was asked, what came back, what it cost to learn. */
export interface RawArchiveEntry {
  /** ISO timestamp of the moment the response arrived. */
  fetched_at: string;
  /** The endpoint path, never the full URL — a query can carry a token. */
  endpoint: string;
  /** Why this call was made, in a few words, for whoever reads the folder later. */
  label: string;
  /** The untouched response body. */
  body: unknown;
}

/**
 * The file a response belongs in, given the day and what it was.
 *
 * Pure, so the naming is testable without a disk. Dated folder per session's
 * work, `raw/` beneath it, and a slug that says what the call was for — the
 * folder is read months later by someone deciding whether they can answer a
 * question without paying again, and `response-3.json` does not help them.
 *
 * `api` names the vendor whose day this is, and defaults to the one that was
 * here first. A second paid API arrived at B11 (web search); filing its
 * responses under `x-api-<day>` would put two vendors' bills in one folder,
 * which is exactly the confusion `research/README.md` exists to prevent.
 */
export function rawArchivePath(label: string, fetchedAt: string, api = "x-api"): string {
  const day = fetchedAt.slice(0, 10);
  const time = fetchedAt.slice(11, 19).replace(/:/g, "");
  return `${api}-${day}/raw/${slugify(label)}-${time}.json`;
}

/** Lowercase, punctuation to hyphens, collapsed, trimmed — a readable file name. */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : "response";
}

/**
 * Wraps a body for archiving.
 *
 * The endpoint is stored as a path with the query string dropped: a raw URL can
 * carry credentials, and `docs/ENGINEERING.md §8` says a token is never written
 * anywhere, including into a file nobody meant to publish.
 */
export function archiveEntry(url: string, label: string, body: unknown, now = new Date()): RawArchiveEntry {
  return {
    fetched_at: now.toISOString(),
    endpoint: endpointOf(url),
    label,
    body,
  };
}

/** The path of a URL, without query or credentials. Falls back safely on a malformed URL. */
export function endpointOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const withoutQuery = url.split("?")[0] ?? url;
    return withoutQuery.replace(/^https?:\/\/[^/]+/, "");
  }
}
