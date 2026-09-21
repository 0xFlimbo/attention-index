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
 * **Two phases — and the saving they were built for is 3.7%.** Enumeration is
 * billed per post returned, profiles per user returned, so phase one pages with
 * no `expansions` and phase two resolves profiles in one batched
 * `/2/users?ids=` call for the top `--profiles` accounts (default 30), ranked by
 * the engagement of their own quote post.
 *
 * The design assumed the expansion would attach a user object on every page the
 * same account appears on. **Measured 2026-09-21 from the ledger, it does not:**
 * the one real run returned 134 user objects for 129 distinct authors. Almost
 * everyone quotes once, and pagination walks a timeline in order, so cross-page
 * repeats are rare. The split therefore buys no discount on a full profile pass
 * — the only thing it buys is the ability to profile a *subset*.
 *
 * **And a subset is dangerous here.** The one officeholder on the swept post
 * ranked 22nd of 128 by that engagement signal, with 3 interactions, on 13 924
 * followers — below the `large-following` threshold. Both signals that identify
 * him live on the paid user object. So a capped pass returns a zero that reads
 * exactly like a post genuinely holding nobody. On a post chosen because
 * officeholders are expected, pass `--profiles 500`: it is a `slice`, so that is
 * a full pass. Keep the cap for exploratory sweeps where a zero is the expected
 * answer. See `docs/X-API.md §11–§12`.
 *
 * That ranking signal is a property of the **post**, not of the person: it says
 * a quote travelled, never that its author matters. It exists only to order a
 * shortlist a human will read.
 *
 * **The flags are signals to read, never a ranking.** Candidates carry plain
 * flags (`government-verified`, `role-phrase`, `large-following`,
 * `register-match`) and are split into "flagged" and "the rest". There is
 * deliberately no score and no order of merit: this project does not invent
 * Influence or Attention numbers (`CLAUDE.md §3`), and a maintenance tool is not
 * a licence to start. A flag means "a human should look at this account",
 * nothing more, and an unflagged account is not thereby uninteresting — the full
 * list is written to the report file for exactly that reason.
 *
 * **Nothing paid for is bought twice.** Every profile ever returned is kept in
 * `research/x-api-profiles.json`, and the store is rebuilt from every research
 * file on each run, so a reading that exists anywhere on disk is reused rather
 * than re-purchased.
 *
 * Credentials: `X_BEARER_TOKEN` is read from `.env.local` and is never logged,
 * echoed, or written anywhere, including in error output.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { postsFileSchema, type Post } from "../src/schemas/post.schema";
import { amplificationsFileSchema } from "../src/schemas/amplification.schema";
import { isQuoteOfPost, knownAccountKeys, signalFlags } from "../src/lib/sweep/quote-candidates";
import {
  buildLegislatorIndex,
  matchLegislators,
  type Legislator,
} from "../src/lib/sweep/legislator-index";
import {
  collectUserObjects,
  mergeProfiles,
  type PaidProfile,
} from "../src/lib/sweep/profile-store";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
/*
 * Sweep output lives in `research/`, not `.cache/`.
 *
 * It used to go to `.cache/quote-sweep/`, which contradicted the project's own
 * rule: `.cache/` sits beside `.next/` in `.gitignore` and is cleared without
 * thought, while a sweep report holds paid enumeration — author ids, quote text,
 * profile readings — that cannot be re-obtained at any price without paying
 * again. `research/README.md` states the rule; this is the tool that was
 * breaking it. Corrected 2026-09-21.
 */
const RESEARCH_DIR = resolve(ROOT, "research");
const SWEEP_DIR = resolve(RESEARCH_DIR, "quote-sweeps");
/** Every profile ever paid for, keyed by account id, so a re-run never re-buys one. */
const PROFILE_STORE = resolve(RESEARCH_DIR, "x-api-profiles.json");
const LEGISLATORS_DIR = resolve(RESEARCH_DIR, "x-api-2026-09-20");
/** Dated readings of every tracked post, kept because a measurement is bought on every run. */
const METRICS_DIR = resolve(RESEARCH_DIR, "post-metrics");

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
  /**
   * **Sometimes truncated, and the remainder is not recoverable here.**
   *
   * A few posts cut off mid-sentence and end with a t.co link. The spec lists a
   * `note_post` field that should carry the rest, so 48 such posts were
   * re-fetched asking for it on 2026-09-21: **0 characters recovered, on all 48**
   * (`docs/X-API.md §13`). The field is valid, accepted and empty on this tier.
   *
   * It is still requested below, because it costs nothing — billing is per
   * resource returned, never per field — and because it may be populated on
   * another tier or another day. It must not be relied on.
   *
   * A post whose text ends in a bare t.co link is usually **not** truncated at
   * all: that is an ordinary post with an attached photo or link, and the t.co
   * is the attachment. Do not treat that shape as evidence of a stub; it was
   * the bad heuristic that sized the re-fetch above.
   */
  text?: string;
  /** Documented home of a long post's remainder. Empty on this tier — see `text`. */
  note_post?: { text?: string } | string;
  /** The same content under the legacy vocabulary, when `tweet.fields` was sent. */
  note_tweet?: { text?: string } | string;
  /** Expanded URLs in the post, so a link is readable without resolving t.co. */
  entities?: Record<string, unknown>;
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

/**
 * Every profile this project has already paid for, keyed by account id.
 *
 * A user read is $0.010 and the store held 456 of them on the day it was
 * introduced — $4.56 already spent. A re-run that bought them again would be
 * paying twice for a reading it never lost, which is the failure
 * `research/README.md` exists to prevent.
 *
 * Each entry keeps the date it was read. A follower count is an observation, not
 * a fact (`docs/DATA.md §5`), so a stored profile is reported with its date and
 * never silently presented as current.
 */
interface StoredProfile extends ApiUser {
  observed_at: string;
}

/**
 * Loads the store, then **rebuilds it from every research file regardless**.
 *
 * The rescan is not a fallback for a missing store, it runs every time, because
 * the failure it prevents is silent: a paid profile sitting in a research file
 * that the store never learned about is re-bought at $0.010 and nothing reports
 * that it was already held. Walking a few JSON files costs milliseconds; the
 * alternative costs money and hides that it did.
 */
function loadProfileStore(): Map<string, StoredProfile> {
  const store = new Map<string, StoredProfile>();

  if (existsSync(PROFILE_STORE)) {
    try {
      const parsed = JSON.parse(readFileSync(PROFILE_STORE, "utf-8")) as StoredProfile[];
      mergeProfiles(store as Map<string, PaidProfile>, parsed);
    } catch (error) {
      // A corrupt store must never abort a sweep: the worst case is re-buying
      // profiles, which is money, and money is cheaper than a lost enumeration.
      console.error(
        `  profile store unreadable (${(error as Error).message}) — rebuilding from research/`,
      );
    }
  }

  const before = store.size;
  let recovered = 0;
  for (const file of researchJsonFiles()) {
    if (file === PROFILE_STORE) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf-8"));
      const { added } = mergeProfiles(store as Map<string, PaidProfile>, collectUserObjects(parsed));
      recovered += added;
    } catch {
      continue; // a malformed research file is not a reason to stop a sweep
    }
  }
  if (recovered > 0) {
    console.log(
      `  profile store: ${before} held, ${recovered} recovered from research files ` +
        `(${store.size} total, $${(store.size * 0.01).toFixed(2)} of user reads already paid)`,
    );
    saveProfileStore(store);
  } else if (store.size > 0) {
    console.log(
      `  profile store: ${store.size} profiles already paid for ` +
        `($${(store.size * 0.01).toFixed(2)} of user reads)`,
    );
  }
  return store;
}

/** Every `.json` under `research/`, recursively. */
function researchJsonFiles(): string[] {
  if (!existsSync(RESEARCH_DIR)) return [];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    });
  return walk(RESEARCH_DIR);
}

function saveProfileStore(store: Map<string, StoredProfile>): void {
  if (isDryRun) return;
  mkdirSync(RESEARCH_DIR, { recursive: true });
  const sorted = [...store.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(PROFILE_STORE, JSON.stringify(sorted, null, 2));
}

/**
 * The U.S. legislator register, free and offline (`docs/X-API.md §7`).
 *
 * Optional: a sweep runs without it, only with weaker flags. Never a reason to
 * stop, because an absent register is not evidence about anybody.
 */
function loadLegislatorIndex(): Legislator[] {
  const current = resolve(LEGISLATORS_DIR, "legislators-current.csv");
  const historical = resolve(LEGISLATORS_DIR, "legislators-historical.csv");
  if (!existsSync(current) || !existsSync(historical)) {
    console.error("  legislator register not found — register matching disabled for this run.");
    return [];
  }
  return buildLegislatorIndex(readFileSync(current, "utf-8"), readFileSync(historical, "utf-8"));
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
  /**
   * **What the account actually said.** Kept because it is the only thing that
   * settles the question every candidate is judged on: did this account perform
   * an act, or merely pass a link along? B14's standing rule turns on exactly
   * that, and one Track A candidate was rejected as "a bare link with no prose"
   * — a ruling impossible to make without the text.
   *
   * It was being bought and discarded. The enumeration pays for the whole post
   * resource, text included; dropping it meant re-opening every candidate by
   * hand to read something already on the wire.
   *
   * Takes `note_post` where it is longer than `text`. Measured 2026-09-21 it
   * never is, on this tier — but the field costs nothing to request and the
   * fallback is correct either way (`docs/X-API.md §13`).
   */
  quote_text: string;
  /** Whether the text above came from `note_post` rather than `text`. Expected false. */
  quote_text_truncated: boolean;
  flags: string[];
}

/** The fullest text a post offers: `note_post` when longer, otherwise `text`. */
function fullPostText(tweet: ApiTweet): { text: string; truncated: boolean } {
  const stub = (tweet.text ?? "").trim();
  // Both vocabularies, because the API mirrors whichever parameter name was
  // sent: `post.fields` yields `note_post`, `tweet.fields` yields `note_tweet`.
  // Reading only one is the bug that cost this project the text it had paid for.
  const raw = tweet.note_post ?? tweet.note_tweet;
  const note = typeof raw === "string" ? raw : raw?.text;
  const full = (note ?? "").trim();
  if (full.length > stub.length) return { text: full, truncated: true };
  return { text: stub, truncated: false };
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

  /*
   * Every field the resource carries, not just `quote_count`.
   *
   * This call buys 32 post reads ($0.16) on every sweep and used to keep one
   * integer from each. The same resource already carries the full
   * `public_metrics` — impressions, likes, reposts, replies, bookmarks — which
   * is precisely the reading `docs/DATA.md §10`'s observation history stores and
   * B12's periodic metric refresh is scoped to fetch. It was being paid for and
   * dropped on the floor, then budgeted for again as if it were new work.
   *
   * Fields are free (`docs/X-API.md §12`); the resource is what costs. So take
   * all of it and write it to `research/` where a later batch can use it.
   */
  const url =
    `${LOOKUP_URL}?ids=${ids.join(",")}` +
    `&post.fields=public_metrics,created_at,text,note_post,entities`;
  const { body } = await fetchJson<{ data?: ApiTweet[] }>(url, token);

  const sizes: PostSize[] = [];
  for (const tweet of body.data ?? []) {
    const post = byStatusId.get(tweet.id);
    if (!post) continue;
    sizes.push({ post, statusId: tweet.id, quoteCount: tweet.public_metrics?.quote_count ?? 0 });
  }
  const missing = ids.length - sizes.length;
  if (missing > 0) console.error(`  ${missing} tracked post(s) were not returned by the API.`);

  /*
   * Persist the whole reading. It is a dated observation of every tracked post,
   * bought on every run, and the only reason it was ever transient is that this
   * function was written to answer one question. A reading cannot be re-taken
   * later (`docs/DATA.md §5`), so it goes to `research/` like every other paid
   * result — never to `data/`, which only a human edits.
   */
  if (!isDryRun && (body.data ?? []).length > 0) {
    const takenAt = new Date().toISOString();
    const file = resolve(METRICS_DIR, `tracked-post-metrics-${takenAt.slice(0, 10)}.json`);
    mkdirSync(METRICS_DIR, { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ observed_at: takenAt, source: "GET /2/tweets?ids=", data: body.data }, null, 2),
    );
    console.log(`  post metrics for ${(body.data ?? []).length} tracked posts saved to ${file}`);
  }

  return sizes.sort((a, b) => b.quoteCount - a.quoteCount);
}

/**
 * Phase two: one batched user lookup for the shortlist, 100 ids per call.
 *
 * This is where the profile cost is paid, once per account rather than once per
 * page the account appeared on. A failure here loses the descriptions, never the
 * enumeration — the caller still reports who was found.
 */
async function fetchProfiles(
  authorIds: string[],
  token: string,
  store: Map<string, StoredProfile>,
): Promise<{ profiles: Map<string, ApiUser>; bought: number; reused: number }> {
  const profiles = new Map<string, ApiUser>();
  if (authorIds.length === 0) return { profiles, bought: 0, reused: 0 };

  // Anything already paid for is free forever. This is the only step in the
  // sweep that can be skipped without losing information.
  const missing: string[] = [];
  let reused = 0;
  for (const authorId of authorIds) {
    const held = store.get(authorId);
    if (held) {
      profiles.set(authorId, held);
      reused += 1;
    } else missing.push(authorId);
  }
  if (reused > 0) {
    console.log(
      `  ${reused} profile(s) already paid for and reused from the store ` +
        `($${(reused * 0.01).toFixed(2)} not spent again); ${missing.length} to buy`,
    );
  }
  if (missing.length === 0) return { profiles, bought: 0, reused };

  const observedAt = new Date().toISOString().slice(0, 10);
  let bought = 0;
  for (let index = 0; index < missing.length; index += 100) {
    const batch = missing.slice(index, index + 100);
    // Billing is per resource returned, never per field, so there is no economy
    // in asking for less about an account you are already buying
    // (`docs/X-API.md §12`). Request everything worth having, once.
    /*
     * Every field worth having, because billing is per resource returned and
     * never per field (`docs/X-API.md §12`). The list was widened 2026-09-21
     * after reading the OpenAPI spec, which is free and documents four fields
     * this tool had never asked for:
     *
     * - `parody`    — X's own parody-account flag. The manual review hit exactly
     *                 this false positive: an account whose bio read "Nobel
     *                 laureate economist" tripped the `economist` role phrase and
     *                 was satire. A free field dismisses that class outright.
     * - `is_identity_verified` — government-ID identity verification, which is a
     *                 different thing from `verified_type: blue` (a subscription)
     *                 and the only other field that speaks to who someone is.
     * - `entities`  — the expanded URLs in a bio. A link to `house.gov` or a
     *                 `.gov` domain is a strong official signal that arrives with
     *                 a profile already being bought.
     * - `verified_followers_count` — followers who are themselves verified; a
     *                 less noisy size reading than the raw count.
     *
     * None of these is a verification on its own, and none is combined into a
     * score (`CLAUDE.md §3`).
     */
    const url =
      `${USERS_URL}?ids=${batch.join(",")}` +
      `&user.fields=username,name,description,location,verified_type,public_metrics,` +
      `created_at,url,entities,parody,is_identity_verified,verified_followers_count`;
    try {
      const { body } = await fetchJson<{ data?: ApiUser[] }>(url, token);
      for (const user of body.data ?? []) {
        profiles.set(user.id, user);
        // Written to the store as it arrives, not at the end: a 402 on the next
        // batch must not discard profiles this one already paid for.
        store.set(user.id, { ...user, observed_at: observedAt });
        bought += 1;
      }
      saveProfileStore(store);
    } catch (error) {
      const reason =
        error instanceof FetchFailure
          ? `HTTP ${error.status} ${error.statusText}`
          : (error as Error).message;
      console.error(`  profile lookup failed (${reason}) — accounts stay enumerated, undescribed`);
      break;
    }
  }
  return { profiles, bought, reused };
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
  /** Profiles actually bought this run, and profiles reused from the store unpaid. */
  profilesBought: number;
  profilesReused: number;
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
  /** Untouched response bodies. Written separately, never into the report. */
  rawPages: QuotePage[];
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
async function sweepPost(
  target: PostSize,
  known: Set<string>,
  token: string,
  profileStore: Map<string, StoredProfile>,
  legislators: Legislator[],
): Promise<SweepResult> {
  const { post, statusId } = target;
  /** author id -> the best quote it made, ranked by that post's own engagement. */
  const byAuthor = new Map<string, { tweet: ApiTweet; signal: number }>();
  let pageToken: string | undefined;
  /** Untouched response bodies, kept because they are the paid evidence. */
  const rawPages: QuotePage[] = [];
  let pagesFetched = 0;
  let entriesSeen = 0;
  let quotesOfThisPost = 0;
  let knownSkipped = 0;
  let exhausted = false;
  let stoppedBy: SweepResult["stoppedBy"] = "max-pages";

  while (pagesFetched < maxPages) {
    let url =
      `${quotesUrl(statusId)}?max_results=${PAGE_SIZE}&exclude=retweets,replies` +
      `&post.fields=created_at,public_metrics,text,note_post,entities`;
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
    rawPages.push(body);
    pagesFetched += 1;
    const tweets = body.data ?? [];
    entriesSeen += tweets.length;

    /*
     * Stop on page one if the field parameter was ignored.
     *
     * The request asks for `tweet.fields`, which is what this account was
     * measured against on 2026-09-20 and what it returns today. The OpenAPI spec
     * read on 2026-09-21 documents the parameter as **`post.fields`** — the
     * rename that came with the Post vocabulary. Both work now; if the old name
     * is ever dropped, the endpoint will not error. It will return entries
     * without `referenced_tweets`, every one will fail the quote test, and the
     * sweep will page happily through the whole post reporting zero quotes while
     * being billed for every entry.
     *
     * That is the expensive failure: a silent one that looks like a real result.
     * One page is the most it can cost.
     */
    const missingRefs = tweets.every((tweet) => tweet.referenced_tweets === undefined);
    const missingAuthors = tweets.every((tweet) => tweet.author_id === undefined);
    if (tweets.length > 0 && (missingRefs || missingAuthors)) {
      stoppedBy =
        `default fields absent — no entry carried ` +
        `${[missingRefs && "`referenced_tweets`", missingAuthors && "`author_id`"]
          .filter(Boolean)
          .join(" or ")}. ` +
        "Neither is a valid `post.fields` value, so neither can be requested: both arrive as " +
        "default fields (docs/X-API.md §16). Without them every entry fails the quote test and " +
        "the sweep bills for a whole post while reporting zero.";
      console.error(`  stopped after 1 page — ${stoppedBy}`);
      break;
    }

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
  const { profiles, bought, reused } = await fetchProfiles(
    shortlist.map(([authorId]) => authorId),
    token,
    profileStore,
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
    /*
     * The register match, free and offline. It is the only signal that reliably
     * reaches a legislator: measured 2026-09-21 against the eight federal
     * legislators in this dataset, matching on the display **name** caught 8 of
     * 8, while matching on the handle or the account id caught 2 — the register
     * records official accounts only, so a personal account
     * (`@realBrandonGill`), a second official-looking handle (`@Rep_Davidson`)
     * and every former member are invisible to both. A name is the one thing
     * about a legislator that is stable across the accounts they open.
     */
    const quoteText = fullPostText(tweet);
    const registerMatches = matchLegislators(
      { name: user.name, username: user.username, authorId },
      legislators,
    );
    candidates.push({
      account: `@${user.username}`,
      name: user.name,
      evidence_url: `https://x.com/${user.username}/status/${tweet.id}`,
      quoted_at: tweet.created_at ? tweet.created_at.slice(0, 10) : null,
      followers: user.public_metrics?.followers_count ?? null,
      verified_type: user.verified_type ?? null,
      description: (user.description ?? "").replace(/\s+/g, " ").trim(),
      quote_text: quoteText.text,
      quote_text_truncated: quoteText.truncated,
      flags: [
        ...signalFlags(user),
        ...registerMatches.slice(0, 1).map(
          ({ legislator, matchedOn }) =>
            `register-match (${matchedOn}): ${legislator.fullName}, ` +
            `${legislator.chamber}-${legislator.state}, ${legislator.era}`,
        ),
      ],
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
    profilesBought: bought,
    profilesReused: reused,
    unprofiledAuthorIds: ranked.slice(profileLimit).map(([authorId]) => authorId),
    knownSkipped,
    exhausted,
    stoppedBy,
    candidates,
    rawPages,
  };
}

function writeReport(result: SweepResult): string {
  const file = resolve(SWEEP_DIR, `${result.statusId}.json`);
  if (isDryRun) return `${file} (not written — dry run)`;
  mkdirSync(SWEEP_DIR, { recursive: true });
  // The raw bodies go to their own file; duplicating them here would make the
  // report unreadable and the two copies free to drift.
  const readable: Partial<SweepResult> = { ...result };
  delete readable.rawPages;
  writeFileSync(file, JSON.stringify({ swept_at: new Date().toISOString(), ...readable }, null, 2));
  return file;
}

/**
 * The untouched API responses, written beside the report.
 *
 * **This is the evidence, and the report is only a reading of it.** A sweep of a
 * 283-quote post pays for ~283 post objects and ~241 user objects; the report
 * keeps the profiled shortlist and a list of bare ids, so every other quote's
 * text, metrics and entities — all paid for — would be gone the moment the
 * process exits.
 *
 * It is also the only way to answer a question that has already come up: when a
 * field arrives empty, was it empty, or was it silently dropped from the
 * request? Processed output cannot distinguish those. Raw output can, and it
 * costs nothing to keep.
 *
 * Added 2026-09-21, after a one-off script written the same day saved only its
 * conclusions and left exactly that question unanswerable. `docs/DATA.md §5` and
 * `research/README.md` say a paid reading cannot be re-taken; a response body is
 * a paid reading.
 */
function writeRawPages(statusId: string, pages: QuotePage[]): string | null {
  if (isDryRun || pages.length === 0) return null;
  const dir = resolve(SWEEP_DIR, "raw");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${statusId}-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        endpoint: `GET /2/tweets/${statusId}/quote_tweets`,
        note: "Untouched response bodies, one per page, in the order returned.",
        pages,
      },
      null,
      2,
    ),
  );
  return file;
}

function printCandidates(result: SweepResult): void {
  const flagged = result.candidates.filter((candidate) => candidate.flags.length > 0);
  const rest = result.candidates.filter((candidate) => candidate.flags.length === 0);

  console.log(
    // `distinctAccounts` is every author enumerated, known ones included — it is not
    // the discovery count, and labelling it as one overstated three runs on 2026-09-20.
    // The number a human acts on is `candidates`: new, profiled and described.
    `\n  ${result.quotesOfThisPost} quotes of this post · ${result.distinctAccounts} distinct accounts · ` +
      `${result.candidates.length} new and described · ${result.knownSkipped} already known · ` +
      `stopped by ${result.stoppedBy}`,
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
  const profileStore = loadProfileStore();
  const legislators = loadLegislatorIndex();

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
    const result = await sweepPost(target, known, token, profileStore, legislators);
    printCandidates(result);
    console.log(`  report: ${writeReport(result)}`);
    const raw = writeRawPages(result.statusId, result.rawPages);
    if (raw) console.log(`  raw:    ${raw}`);
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
  const candidatesTotal = results.reduce((sum, result) => sum + result.candidates.length, 0);
  const unprofiledTotal = results.reduce((sum, result) => sum + result.unprofiledAuthorIds.length, 0);

  console.log(`\nswept ${results.length} post(s)`);
  console.log(`  distinct accounts enumerated  ${accountsTotal}`);
  console.log(`  new, profiled and described   ${candidatesTotal}`);
  console.log(`  carrying a role signal        ${flaggedTotal}`);
  // Unprofiled authors are not "nothing found" — they are accounts nobody has looked at.
  // Reported separately so a zero-candidate run cannot be read as an exhausted post.
  console.log(`  enumerated but never profiled ${unprofiledTotal}`);
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
