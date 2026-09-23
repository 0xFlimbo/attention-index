/**
 * docs/TOOLS.md §4 — what a run of `enrich:twitter` would look up and what
 * that would cost, decided before any request is made.
 *
 * Pure, so the plan mode can be tested without a network call or a token.
 * `scripts/enrich-twitter-posts.ts` only extracts status ids from
 * `data/posts.json` / `data/amplifications.json` and prints what this
 * computes.
 */

/** Price per resource, X API v2 (docs/PROVIDERS.md §2.2). */
export const COST_PER_POST_READ = 0.005;
/** `expansions=author_id` bills a user read per distinct author returned — never per post. */
export const COST_PER_USER_READ = 0.01;

/** The tweet-lookup endpoint's own ceiling on ids per request. */
export const IDS_PER_REQUEST = 100;

export interface EnrichmentPlan {
  /** Tracked posts whose url carries a tweet id. */
  postIdCount: number;
  /** Amplification evidence urls that carry a tweet id. */
  amplificationIdCount: number;
  /** The two id sets combined. */
  totalIdCount: number;
  /** Batches of <=100 ids a `--fetch` run would send — posts and amplifications batched separately. */
  requestCount: number;
  /** Billed once per id returned, at $0.005 (docs/PROVIDERS.md §2.2). Certain, not modelled up. */
  postReadCost: number;
  /**
   * Billed once per *distinct author* the API returns for `expansions=author_id`,
   * at $0.010 — never per id. This is the ceiling of one author per id, printed
   * as an upper bound because the true count is only known once the API answers.
   */
  maxUserReadCost: number;
  /** `postReadCost` alone — the floor of what a `--fetch` run would bill. */
  minCost: number;
  /** `postReadCost + maxUserReadCost` — the ceiling of what a `--fetch` run would bill. */
  maxCost: number;
}

/**
 * `requestCount` batches posts and amplification ids separately, matching how
 * the script actually sends them (`chunk(postIds, 100)` and
 * `chunk(ampIds, 100)`, fetched independently) — combining the two id lists
 * before batching would under-count when both are non-empty and neither is a
 * multiple of 100.
 */
export function planEnrichment(postIds: readonly string[], amplificationIds: readonly string[]): EnrichmentPlan {
  const totalIdCount = postIds.length + amplificationIds.length;
  const requestCount =
    Math.ceil(postIds.length / IDS_PER_REQUEST) + Math.ceil(amplificationIds.length / IDS_PER_REQUEST);
  const postReadCost = totalIdCount * COST_PER_POST_READ;
  const maxUserReadCost = totalIdCount * COST_PER_USER_READ;

  return {
    postIdCount: postIds.length,
    amplificationIdCount: amplificationIds.length,
    totalIdCount,
    requestCount,
    postReadCost,
    maxUserReadCost,
    minCost: postReadCost,
    maxCost: postReadCost + maxUserReadCost,
  };
}
