/**
 * pnpm sweep:quotes [-- --measure] [-- --post <id>] [-- --all]
 *                   [-- --max-pages N] [-- --profiles N] [-- --delay MS] [-- --dry-run]
 *
 * Occasional maintenance tool (docs/ENGINEERING.md §18). Never called during
 * `next build`, rendering, or CI.
 *
 * **Strictly read-only against `data/`.** It enumerates the accounts that quoted
 * a tracked post, drops the ones already recorded, and reports the rest as
 * candidates for a human to read. It never writes an amplification: promotion
 * is a human edit, and a discovery sweep is exactly where auto-promotion would
 * do the most damage (`docs/WORKPLAN.md` B10–B12).
 *
 * Why the batch exists: all four federal legislators in `data/amplifications.json`
 * surfaced by accident, one of them from a Breitbart embed. This makes the
 * search systematic instead of lucky.
 *
 * ---------------------------------------------------------------------------
 * Four facts measured on 2026-09-20, before this tool was written. Each one
 * changed its shape, so they are recorded here rather than in a report nobody
 * re-reads.
 *
 * 1. **The tracked set carries 6 817 quote posts, not ~3 000.** The estimate
 *    this batch inherited ("156–680 per post, ~3 000 total") was taken when the
 *    dataset held 21 posts and was never derivable from the repo — the
 *    observation schema stores views, likes, reposts, replies and bookmarks, and
 *    no quote count at all. Re-measured across the 32 verified posts via the
 *    tweet-lookup endpoint: total 6 817, range 18–964, median 165, and no post
 *    at zero. `--measure` is that measurement, kept as a mode so the number is
 *    re-taken rather than quoted.
 *
 * 2. **The binding constraint is an API credit budget, not the rate limit.**
 *    The endpoint is reachable and its rate limit is 75 requests per 15 minutes,
 *    which a full sweep (≥69 pages at 100 entries each) would cross in two or
 *    three windows. That is not what stops it. After ~14 requests the account
 *    began answering `402 credits depleted` on **every** v2 endpoint — tweet
 *    lookup included — while the rate-limit headers still reported 3 496 and 60
 *    remaining. So the two budgets are independent, the credit one is far
 *    smaller, and it is the one to plan against: a sweep of the whole tracked
 *    set costs multiples of what this token currently holds. `--max-pages`
 *    exists so a run can never quietly spend more than it was given, and
 *    `--measure` costs exactly one request.
 *
 * 3. **Most of what the endpoint returns is not a quote of the tracked post.**
 *    On the highest-quote post, 94 of the first 96 entries were plain retweets
 *    (`RT @…`), and with only retweets excluded the next 392 entries still
 *    resolved to 199 quotes and 151 replies — a 51% density. Excluding replies
 *    as well took a later run to **99%** (150 genuine quotes of 151 entries).
 *    So the request carries `exclude=retweets,replies` and the tool then
 *    confirms `referenced_tweets` actually holds `quoted → <this post>`.
 *    A retweet is also the wrong record on its own terms
 *    — it is someone else's quote post travelling, an act belonging to the
 *    account that wrote the quote, not to the account that passed it on. That is
 *    B14's standing rule: a surface that carries no act of its own is archived on
 *    sight, never fitted into a value that does not belong to it.
 *
 * 4. **`verified_type` is not a public-role signal.** Across 105 distinct
 *    quoting accounts on that post it returned only `blue` (48) and `none` (57)
 *    — a paid subscription, not an office. So the flags below never treat a blue
 *    check as standing for anything, and the same sample surfaced no official and
 *    no journalist at all: a sweep that returns nothing is a real outcome here,
 *    not a malfunction.
 *
 * 5. **The sweep mechanism works; the budget is what it is waiting on.** Seven
 *    pages of the highest-quote post ran end to end before the credits went:
 *    604 quotes of that post, 274 accounts not already recorded, every page
 *    paginating cleanly. What stopped was the funding, not the tool.
 * ---------------------------------------------------------------------------
 *
 * **Two phases, because the two costs are separate.** Enumeration is billed per
 * post returned; profiles are billed per user returned. So phase one pages
 * through the quotes with no `expansions` at all — `author_id` is a tweet field
 * and rides along free, while the expansion would attach a user object on every
 * page the same account appears on. Phase two resolves profiles in one batched
 * `/2/users?ids=` call, for the top `--profiles` accounts only (default 30),
 * ranked by the engagement of their own quote post. Authors enumerated but not
 * profiled keep their ids in the report, so a later run can describe them
 * without re-paying to find them.
 *
 * That ranking signal is a property of the **post**, not of the person: it says
 * a quote travelled, never that its author matters. It exists only to order a
 * shortlist a human will read.
 *
 * **The flags are signals to read, never a ranking.** Candidates carry plain
 * flags (`government-verified`, `role-phrase`, `large-following`) and are split
 * into "flagged" and "the rest". There is deliberately no score and no order of
 * merit: this project does not invent Influence or Attention numbers
 * (`CLAUDE.md §3`), and a maintenance tool is not a licence to start. A flag
 * means "a human should look at this account", nothing more, and an unflagged
 * account is not thereby uninteresting — the full list is written to the report
 * file for exactly that reason.
 *
 * Credentials: `X_BEARER_TOKEN` is read from `.env.local` and is never logged,
 * echoed, or written anywhere, including in error output.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { postsFileSchema, type Post } from "../src/schemas/post.schema";
import { amplificationsFileSchema } from "../src/schemas/amplification.schema";
import { isQuoteOfPost, knownAccountKeys, signalFlags } from "../src/lib/sweep/quote-candidates";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const CACHE_DIR = resolve(ROOT, ".cache");
const SWEEP_DIR = resolve(CACHE_DIR, "quote-sweep");

const LOOKUP_URL = "https://api.x.com/2/tweets";
const USERS_URL = "https://api.x.com/2/users";
const quotesUrl = (statusId: string) => `https://api.x.com/2/tweets/${statusId}/quote_tweets`;
/** The endpoint's own ceiling; a smaller page would only cost more requests. */
const PAGE_SIZE = 100;
const RATE_LIMIT_PER_WINDOW = 75;
const MAX_RETRIES = 4;


// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flagValue(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const postFilter = flagValue("post");
const sweepAll = args.includes("--all");
// `--measure` is the default: the cheap mode must be the one an unqualified run
// gets, so a mistyped flag costs one request rather than a rate window.
const measureOnly = args.includes("--measure") || (!postFilter && !sweepAll);
const maxPages = Number(flagValue("max-pages") ?? 10);
/**
 * How many of a post's quoting accounts get a profile lookup. Enumeration is
 * billed per post returned and profiles per user returned, so this is the one
 * knob that separates "how much did we look at" from "how much did we pay to
 * describe it". 30 covers the shortlist a human would read anyway.
 */
const profileLimit = Number(flagValue("profiles") ?? 30);
const delayMs = Number(flagValue("delay") ?? 1_200);
const isDryRun = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/** Reads X_BEARER_TOKEN from .env.local without ever logging it. Never uses dotenv/`cat`. */
function loadBearerToken(): string {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found. Create it from .env.example and set X_BEARER_TOKEN.");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^X_BEARER_TOKEN=(.*)$/);
    if (match) {
      const token = match[1]?.trim() ?? "";
      if (token.length > 0) return token;
      break;
    }
  }
  console.error("X_BEARER_TOKEN is missing or empty in .env.local.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// X API types (only the fields this script reads)
// ---------------------------------------------------------------------------

interface ApiReferencedTweet {
  type: "quoted" | "replied_to" | "retweeted";
  id: string;
}

interface ApiTweet {
  id: string;
  author_id?: string;
  created_at?: string;
  text?: string;
  referenced_tweets?: ApiReferencedTweet[];
  public_metrics?: Record<string, number>;
}

interface ApiUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  location?: string;
  verified_type?: string;
  public_metrics?: { followers_count?: number };
}

interface QuotePage {
  data?: ApiTweet[];
  includes?: { users?: ApiUser[] };
  meta?: { next_token?: string; result_count?: number };
}

class FetchFailure extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

function extractStatusId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Retries only on 429/5xx, honouring `x-rate-limit-reset`. Any other non-2xx
 * (401/403 — a tier without access to this endpoint) is reported verbatim and
 * thrown immediately: never retried, never worked around.
 */
async function fetchJson<T>(
  url: string,
  token: string,
): Promise<{ body: T; remaining: string | null }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (attempt === MAX_RETRIES) throw new Error(`network error: ${(error as Error).message}`);
      await sleep(1_000 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return {
        body: (await response.json()) as T,
        remaining: response.headers.get("x-rate-limit-remaining"),
      };
    }

    const retryable = response.status === 429 || response.status >= 500;
    const bodyText = await response.text().catch(() => "");
    if (!retryable || attempt === MAX_RETRIES) {
      throw new FetchFailure(response.status, response.statusText, bodyText);
    }

    const reset = response.headers.get("x-rate-limit-reset");
    let waitMs = 1_000 * 2 ** attempt;
    if (reset) {
      const untilReset = Number(reset) * 1_000 - Date.now();
      // Capped: the window is 15 minutes and a run that parks for all of it
      // looks indistinguishable from a hang.
      if (Number.isFinite(untilReset) && untilReset > 0) waitMs = Math.min(untilReset, 60_000);
    }
    console.error(
      `  attempt ${attempt + 1} failed with HTTP ${response.status}; retrying in ${Math.round(waitMs / 1_000)}s`,
    );
    await sleep(waitMs);
  }
  throw new Error("fetchJson: exhausted retries without a terminal result");
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function readDataFile<T>(fileName: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, fileName), "utf-8")) as T;
}

/** docs/DATA.md §3 — the public inclusion rule, the only posts worth sweeping. */
function eligiblePosts(): Post[] {
  return postsFileSchema
    .parse(readDataFile("posts.json"))
    .filter((post) => post.status === "verified" && post._placeholder !== true);
}

// ---------------------------------------------------------------------------
// Candidate shaping
// ---------------------------------------------------------------------------

interface Candidate {
  account: string;
  name: string;
  /** The quoting post itself — what a human opens, and what becomes evidence_url. */
  evidence_url: string;
  quoted_at: string | null;
  followers: number | null;
  verified_type: string | null;
  description: string;
  flags: string[];
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

interface PostSize {
  post: Post;
  statusId: string;
  quoteCount: number;
}

/**
 * One batched request for the whole tracked set — the lookup endpoint takes up
 * to 100 ids per call. This is what sizes a sweep before it spends anything.
 */
async function measure(posts: Post[], token: string): Promise<PostSize[]> {
  const byStatusId = new Map<string, Post>();
  for (const post of posts) {
    const statusId = extractStatusId(post.url);
    if (statusId) byStatusId.set(statusId, post);
    else console.error(`  ${post.id}: no status id in url — skipped`);
  }
  const ids = [...byStatusId.keys()];
  if (ids.length === 0) return [];

  const url = `${LOOKUP_URL}?ids=${ids.join(",")}&tweet.fields=public_metrics`;
  const { body } = await fetchJson<{ data?: ApiTweet[] }>(url, token);

  const sizes: PostSize[] = [];
  for (const tweet of body.data ?? []) {
    const post = byStatusId.get(tweet.id);
    if (!post) continue;
    sizes.push({ post, statusId: tweet.id, quoteCount: tweet.public_metrics?.quote_count ?? 0 });
  }
  const missing = ids.length - sizes.length;
  if (missing > 0) console.error(`  ${missing} tracked post(s) were not returned by the API.`);
  return sizes.sort((a, b) => b.quoteCount - a.quoteCount);
}

/**
 * Phase two: one batched user lookup for the shortlist, 100 ids per call.
 *
 * This is where the profile cost is paid, once per account rather than once per
 * page the account appeared on. A failure here loses the descriptions, never the
 * enumeration — the caller still reports who was found.
 */
async function fetchProfiles(authorIds: string[], token: string): Promise<Map<string, ApiUser>> {
  const profiles = new Map<string, ApiUser>();
  if (authorIds.length === 0) return profiles;

  for (let index = 0; index < authorIds.length; index += 100) {
    const batch = authorIds.slice(index, index + 100);
    const url =
      `${USERS_URL}?ids=${batch.join(",")}` +
      `&user.fields=username,name,description,location,verified_type,public_metrics`;
    try {
      const { body } = await fetchJson<{ data?: ApiUser[] }>(url, token);
      for (const user of body.data ?? []) profiles.set(user.id, user);
    } catch (error) {
      const reason =
        error instanceof FetchFailure
          ? `HTTP ${error.status} ${error.statusText}`
          : (error as Error).message;
      console.error(`  profile lookup failed (${reason}) — accounts stay enumerated, undescribed`);
      break;
    }
  }
  return profiles;
}

interface SweepResult {
  postId: string;
  statusId: string;
  pagesFetched: number;
  entriesSeen: number;
  quotesOfThisPost: number;
  distinctAccounts: number;
  /** How many of those got a profile lookup — the billed subset. */
  profiledAccounts: number;
  /**
   * Authors enumerated but never profiled, kept so a later run can resolve them
   * without re-paying for the enumeration that found them.
   */
  unprofiledAuthorIds: string[];
  knownSkipped: number;
  exhausted: boolean;
  /**
   * Why pagination stopped. `"end-of-list"` means the post is fully swept;
   * anything else means it is not, and the post is worth resuming when the
   * blocker clears.
   */
  stoppedBy: "end-of-list" | "max-pages" | string;
  candidates: Candidate[];
}

/**
 * Phase one: enumerate one post's quote posts, **without profiles**.
 *
 * Two deliberate economies, both measured (docs/X-API.md):
 *
 * - `exclude=retweets,replies`, not just retweets. The endpoint's timeline
 *   carries replies inside the quote threads; excluding only retweets left a
 *   51% genuine-quote density, excluding both took it to 99%. Every entry the
 *   filter removes is an entry you do not pay $0.005 to discard.
 * - **No `expansions=author_id`.** `author_id` is a tweet field and arrives
 *   free; the expansion attaches a whole user object per page, and the same
 *   account quoting across ten pages is billed on each one. Profiles are
 *   fetched once, in phase two, for the shortlist only.
 */
async function sweepPost(target: PostSize, known: Set<string>, token: string): Promise<SweepResult> {
  const { post, statusId } = target;
  /** author id -> the best quote it made, ranked by that post's own engagement. */
  const byAuthor = new Map<string, { tweet: ApiTweet; signal: number }>();
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let entriesSeen = 0;
  let quotesOfThisPost = 0;
  let knownSkipped = 0;
  let exhausted = false;
  let stoppedBy: SweepResult["stoppedBy"] = "max-pages";

  while (pagesFetched < maxPages) {
    let url =
      `${quotesUrl(statusId)}?max_results=${PAGE_SIZE}&exclude=retweets,replies` +
      `&tweet.fields=created_at,referenced_tweets,author_id,public_metrics`;
    if (pageToken) url += `&pagination_token=${pageToken}`;

    /*
     * A failure mid-pagination keeps the pages already paid for. This is not
     * defensive habit: on 2026-09-20 the seventh page of the first real sweep
     * returned `402 credits depleted`, and an earlier version of this loop let
     * the throw escape, discarding 274 accounts that six successful requests
     * had already bought. Where the budget is the scarce resource, losing
     * completed work to an error on the next call is the expensive bug.
     */
    let page: { body: QuotePage; remaining: string | null };
    try {
      page = await fetchJson<QuotePage>(url, token);
    } catch (error) {
      stoppedBy =
        error instanceof FetchFailure
          ? `HTTP ${error.status} ${error.statusText}: ${error.body.slice(0, 160)}`
          : (error as Error).message;
      console.error(`  stopped after ${pagesFetched} page(s) — ${stoppedBy}`);
      break;
    }
    const { body, remaining } = page;
    pagesFetched += 1;
    const tweets = body.data ?? [];
    entriesSeen += tweets.length;

    for (const tweet of tweets) {
      // The second filter: `exclude` is server-side and imperfect, so confirm
      // the entry actually quotes *this* post rather than sitting in its thread.
      if (!isQuoteOfPost(tweet.referenced_tweets, statusId)) continue;
      quotesOfThisPost += 1;
      if (!tweet.author_id) continue;

      // Ranking signal, available without a profile: how far the quote itself
      // travelled. It is a property of the post, never of the person — no
      // claim is made that a widely-shared quote comes from a notable account.
      const metrics = tweet.public_metrics ?? {};
      const signal =
        (metrics.like_count ?? 0) + (metrics.retweet_count ?? 0) + (metrics.quote_count ?? 0);

      // One row per account: the same account quoting twice is one entity to
      // read (`docs/DATA.md §10` counts entities once). Keep its loudest quote.
      const held = byAuthor.get(tweet.author_id);
      if (!held || signal > held.signal) byAuthor.set(tweet.author_id, { tweet, signal });
    }

    console.log(
      `  page ${pagesFetched}: ${tweets.length} entries · ${quotesOfThisPost} quotes so far · ` +
        `${byAuthor.size} distinct authors · rate remaining ${remaining ?? "?"}`,
    );

    pageToken = body.meta?.next_token;
    if (!pageToken) {
      exhausted = true;
      stoppedBy = "end-of-list";
      break;
    }
    await sleep(delayMs);
  }

  // Phase two: profiles, for the shortlist only.
  const ranked = [...byAuthor.entries()].sort((a, b) => b[1].signal - a[1].signal);
  const shortlist = ranked.slice(0, profileLimit);
  const profiles = await fetchProfiles(
    shortlist.map(([authorId]) => authorId),
    token,
  );

  const candidates: Candidate[] = [];
  for (const [authorId, { tweet }] of shortlist) {
    const user = profiles.get(authorId);
    if (!user) continue;
    const account = `@${user.username.toLowerCase()}`;
    if (known.has(account)) {
      knownSkipped += 1;
      continue;
    }
    candidates.push({
      account: `@${user.username}`,
      name: user.name,
      evidence_url: `https://x.com/${user.username}/status/${tweet.id}`,
      quoted_at: tweet.created_at ? tweet.created_at.slice(0, 10) : null,
      followers: user.public_metrics?.followers_count ?? null,
      verified_type: user.verified_type ?? null,
      description: (user.description ?? "").replace(/\s+/g, " ").trim(),
      flags: signalFlags(user),
    });
  }

  if (ranked.length > shortlist.length) {
    console.log(
      `  ${ranked.length - shortlist.length} further author(s) enumerated but not profiled ` +
        `(--profiles ${profileLimit}); their ids are in the report file.`,
    );
  }

  return {
    postId: post.id,
    statusId,
    pagesFetched,
    entriesSeen,
    quotesOfThisPost,
    distinctAccounts: byAuthor.size,
    profiledAccounts: shortlist.length,
    unprofiledAuthorIds: ranked.slice(profileLimit).map(([authorId]) => authorId),
    knownSkipped,
    exhausted,
    stoppedBy,
    candidates,
  };
}

function writeReport(result: SweepResult): string {
  const file = resolve(SWEEP_DIR, `${result.statusId}.json`);
  if (isDryRun) return `${file} (not written — dry run)`;
  mkdirSync(SWEEP_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ swept_at: new Date().toISOString(), ...result }, null, 2));
  return file;
}

function printCandidates(result: SweepResult): void {
  const flagged = result.candidates.filter((candidate) => candidate.flags.length > 0);
  const rest = result.candidates.filter((candidate) => candidate.flags.length === 0);

  console.log(
    `\n  ${result.quotesOfThisPost} quotes of this post · ${result.distinctAccounts} accounts not yet recorded · ` +
      `${result.knownSkipped} already known · stopped by ${result.stoppedBy}`,
  );

  if (flagged.length === 0) {
    console.log("  no account carried a public-role signal on this post.");
  } else {
    console.log(`\n  flagged for reading (${flagged.length}):`);
    for (const candidate of flagged) {
      console.log(`    ${candidate.account}  ${candidate.name}`);
      console.log(`      ${candidate.flags.join(" · ")}`);
      console.log(`      ${candidate.evidence_url}  (${candidate.quoted_at ?? "date unknown"})`);
      if (candidate.description) console.log(`      "${candidate.description.slice(0, 110)}"`);
    }
  }
  console.log(`  unflagged accounts in the report file: ${rest.length}`);
  console.log(
    `  profiled ${result.profiledAccounts} of ${result.distinctAccounts} distinct authors` +
      `${result.unprofiledAuthorIds.length > 0 ? ` (${result.unprofiledAuthorIds.length} left unprofiled, ids kept)` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const token = loadBearerToken();
  const posts = eligiblePosts();
  const amplifications = amplificationsFileSchema.parse(readDataFile("amplifications.json"));
  const known = knownAccountKeys(amplifications);

  console.log(
    `${posts.length} verified posts · ${amplifications.length} amplification records ` +
      `· ${known.size} accounts already known${isDryRun ? " · DRY RUN" : ""}\n`,
  );

  let sizes: PostSize[];
  try {
    sizes = await measure(posts, token);
  } catch (error) {
    // Every mode starts here, so a depleted budget otherwise surfaces as one
    // bare line with no cause. Say which of the two budgets ran out, because
    // waiting helps for one of them and not for the other.
    if (error instanceof FetchFailure && error.status === 402) {
      console.error(
        "The X API answered 402 (credits depleted). This is the account's credit budget,\n" +
          "not the 75-per-15-minutes rate limit — measured 2026-09-20, the rate-limit headers\n" +
          "still reported thousands remaining while every v2 endpoint returned 402. Waiting\n" +
          "does not clear it; the budget has to be topped up before any sweep can run.",
      );
      process.exit(1);
    }
    throw error;
  }
  const total = sizes.reduce((sum, size) => sum + size.quoteCount, 0);
  const counts = sizes.map((size) => size.quoteCount);

  console.log("measured quote posts across the tracked set");
  console.log(`  total     ${total}`);
  console.log(`  range     ${counts.at(-1) ?? 0}–${counts[0] ?? 0}`);
  console.log(`  median    ${counts[Math.floor(counts.length / 2)] ?? 0}`);
  console.log(`  at zero   ${counts.filter((count) => count === 0).length}`);
  console.log(
    `  a full sweep is at least ${Math.ceil(total / PAGE_SIZE)} requests at ${PAGE_SIZE} per page, ` +
      `against a limit of ${RATE_LIMIT_PER_WINDOW} per 15 minutes.`,
  );

  if (measureOnly) {
    console.log("\nlargest first:");
    for (const size of sizes.slice(0, 10)) {
      console.log(`  ${String(size.quoteCount).padStart(4)}  ${size.post.id}`);
    }
    console.log(
      "\nMeasurement only — nothing was swept. Run with `--post <id>` to sweep one post,\n" +
        "or `--all` to walk the set largest first. Neither writes to data/.",
    );
    return;
  }

  const targets = postFilter
    ? sizes.filter((size) => size.post.id === postFilter || size.statusId === postFilter)
    : sizes;

  if (targets.length === 0) {
    console.error(`\nNo verified post matched "${postFilter}".`);
    process.exit(1);
  }

  const results: SweepResult[] = [];
  for (const target of targets) {
    console.log(`\n${target.post.id}  (${target.quoteCount} quote posts reported)`);
    console.log(`  ${target.post.title}`);
    const result = await sweepPost(target, known, token);
    printCandidates(result);
    console.log(`  report: ${writeReport(result)}`);
    results.push(result);
    // An account found on one post is not a fresh discovery on the next.
    for (const candidate of result.candidates) known.add(candidate.account.toLowerCase());

    // A depleted budget is not a per-post failure to isolate: the next post
    // would spend a request to be told the same thing. Stop, and say which
    // posts were never reached so the run can be resumed rather than repeated.
    if (result.stoppedBy.includes("402")) {
      const remainingTargets = targets.slice(targets.indexOf(target) + 1);
      console.error(
        `\nAPI budget exhausted. ${remainingTargets.length} post(s) not swept:` +
          `\n  ${remainingTargets.map((t) => t.post.id).join("\n  ")}`,
      );
      break;
    }
    if (targets.length > 1) await sleep(delayMs);
  }

  const flaggedTotal = results.reduce(
    (sum, result) => sum + result.candidates.filter((candidate) => candidate.flags.length > 0).length,
    0,
  );
  const accountsTotal = results.reduce((sum, result) => sum + result.distinctAccounts, 0);

  console.log(`\nswept ${results.length} post(s)`);
  console.log(`  accounts not yet recorded   ${accountsTotal}`);
  console.log(`  carrying a role signal      ${flaggedTotal}`);
  console.log(
    "\nA flag is NOT a verification and NOT a ranking: it means an account described itself\n" +
      "in words worth reading, not that it belongs in the dataset. Open the quoting post,\n" +
      "confirm the account and the role, then write the record by hand (docs/DATA.md §6).\n" +
      "Nothing here was written to data/.",
  );
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
