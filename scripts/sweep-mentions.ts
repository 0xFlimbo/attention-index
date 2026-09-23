/**
 * pnpm sweep:mentions [-- --sweep] [-- --since-id <id>] [-- --start-time <ISO>]
 *                     [-- --max-pages N] [-- --dry-run]
 *
 * **Track A** (docs/WORKPLAN.md B10, docs/X-API.md §5–§6): the full-archive
 * search over every post whose *text* names the account, the brand word or the
 * domain. The complement of `sweep:quotes`, which is Track B and reads the
 * quote timeline of one post.
 *
 * The two barely overlap, and that is measured rather than assumed: **0 of the
 * 10 pre-existing records were findable by Track A**, because a quote post
 * attaches a card instead of text (`docs/X-API.md §4`). Track A finds outlets
 * and commentators, who cite in prose; Track B finds the officeholders, who
 * quote in silence.
 *
 * ---------------------------------------------------------------------------
 * **Why this file exists at all: it was run twice as ad-hoc `curl`.**
 *
 * Track A produced five of this project's records and was never written down as
 * a program. Both runs — 2026-09-20 ($3.27) and the 2026-09-21 incremental
 * ($0.12) — were hand-assembled request strings, which is how the field-name
 * bugs in `docs/X-API.md §16` happened in the first place: an ad-hoc request is
 * validated by nobody, tested by nothing, and reconstructed from a doc by the
 * next person under time pressure.
 *
 * Committing it buys three things a `curl` line cannot:
 *
 * - `tests/api-field-validity.test.ts` reads `scripts/` and validates every
 *   field name here against the OpenAPI spec. An ad-hoc request is invisible to it.
 * - the `since_id` high-water mark is read from and written to disk, so an
 *   incremental cannot silently re-buy a window someone already paid for;
 * - the candidate logic is the same code Track B uses, so a rule fixed in one
 *   track is fixed in both. The `MIN_SURNAME_LENGTH` bug that hid a sitting
 *   congressman was in shared code and would otherwise have been fixed once.
 * ---------------------------------------------------------------------------
 *
 * **Cheap mode is the default.** An unqualified run only *sizes* the window
 * with `counts` — $0.01 per 31 days of window — and prints what a fetch would cost.
 * `--sweep` is what spends. This mirrors `sweep:quotes`, where `--measure` is
 * the default for the same reason: a mistyped flag should cost a cent.
 *
 * **Strictly read-only against `data/`.** It reports candidates; a human writes
 * the record. Every run also prints, per candidate, the claims that must be
 * confirmed against a source that is not the account — see `verificationClaims`.
 *
 * Credentials: `X_BEARER_TOKEN` is read from `.env.local` and is never logged,
 * echoed, or written anywhere, including in error output.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { amplificationsFileSchema } from "../src/schemas/amplification.schema";
import {
  knownAccountKeys,
  signalFlags,
  verificationClaims,
  type QuotingAccount,
} from "../src/lib/sweep/quote-candidates";
import {
  buildLegislatorIndex,
  matchLegislators,
  type Legislator,
} from "../src/lib/sweep/legislator-index";
import { collectUserObjects, mergeProfiles, type PaidProfile } from "../src/lib/sweep/profile-store";
import { archiveEntry, rawArchivePath } from "../src/lib/sweep/raw-archive";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const RESEARCH_DIR = resolve(ROOT, "research");
const PROFILE_STORE = resolve(RESEARCH_DIR, "x-api-profiles.json");
const LEGISLATORS_DIR = resolve(RESEARCH_DIR, "x-api-2026-09-20");
/** The `since_id` high-water mark, so an incremental never re-buys a paid window. */
const STATE_FILE = resolve(RESEARCH_DIR, "track-a-state.json");

const SEARCH_URL = "https://api.x.com/2/tweets/search/all";
const COUNTS_URL = "https://api.x.com/2/tweets/counts/all";
const CREDITS_URL = "https://api.x.com/2/usage/credits";

/**
 * The query, verbatim from `docs/X-API.md §6` with this project's values
 * substituted. Kept as one constant because it is the thing that must not drift
 * between runs: a different query is a different population, and comparing two
 * runs of different queries silently answers the wrong question.
 *
 * `(is:quote OR -is:reply)` keeps quote posts while dropping ordinary replies,
 * which were **97% of raw mention volume** and are thread noise (§3).
 */
const QUERY =
  '(@LayoffAI OR layoffhedge OR url:"layoffhedge.com") -is:retweet -from:LayoffAI (is:quote OR -is:reply)';

/**
 * Billing is per resource returned, never per field (`docs/X-API.md §12`), so
 * every field worth having is requested once. `note_tweet` is not optional
 * here: on the 2026-09-20 corpus **24 of 48 posts named the project only in the
 * text past the truncation point**, and reading `text` alone discarded it.
 *
 * `tweet.fields` rather than `post.fields`, consistently with `note_tweet` —
 * the response mirrors whichever vocabulary was sent, and mixing them is the
 * bug that cost this project a paid page (§16).
 */
const TWEET_FIELDS =
  "created_at,public_metrics,referenced_tweets,author_id,lang,note_tweet,entities,text";
const USER_FIELDS =
  "username,name,description,verified_type,public_metrics,location,created_at,entities,parody,is_identity_verified,verified_followers_count";

/**
 * Follower floor for *reading* a candidate, not for recording one.
 *
 * Established by Track A on 2026-09-20 and confirmed: of 210 authors below it,
 * 16 carried a role phrase and none carried weight — the largest was a
 * web-performance developer at 4,102, and not one had a non-`blue`
 * `verified_type`. It decides who gets read, never who gets recorded: the
 * Chaffetz rule judges an act on what it does, never on how large the account
 * is, and an officeholder below this line is still a record.
 */
const READING_FLOOR = 5_000;

const PAGE_SIZE = 500;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : (args[index + 1] ?? null);
};

/** Sizing is the default; spending is opt-in. */
const doSweep = args.includes("--sweep");
const isDryRun = args.includes("--dry-run");
const maxPages = Number(flagValue("max-pages") ?? 10);
const startTimeArg = flagValue("start-time");
const sinceIdArg = flagValue("since-id");

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/** Reads X_BEARER_TOKEN from .env.local without ever logging it. */
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
// API types — only what this script reads
// ---------------------------------------------------------------------------

interface ApiUser extends QuotingAccount {
  id: string;
  location?: string;
  is_identity_verified?: boolean;
}

interface ApiTweet {
  id: string;
  author_id?: string;
  created_at?: string;
  text?: string;
  note_tweet?: { text?: string } | string;
  entities?: Record<string, unknown>;
  public_metrics?: Record<string, number>;
}

interface SearchPage {
  data?: ApiTweet[];
  includes?: { users?: ApiUser[] };
  meta?: { next_token?: string; result_count?: number; newest_id?: string; oldest_id?: string };
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

/**
 * Every request this script makes, archived before it is parsed.
 *
 * `label` is not decoration: it is what the folder tells someone months from
 * now about whether a question can be answered without paying again. Passing
 * `billed: false` skips the archive for the metering endpoint, which returns a
 * balance rather than content and costs nothing.
 */
async function fetchJson<T>(
  url: string,
  token: string,
  label: string,
  billed = true,
): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new FetchFailure(response.status, response.statusText, body.slice(0, 400));
  }
  const body = (await response.json()) as T;
  // Persist before parsing: a misunderstood request and an absent field look
  // identical once the response has been read away (docs/X-API.md §15).
  if (billed && !isDryRun) archiveRaw(url, label, body);
  return body;
}

/** Writes one archived response under `research/`, creating the dated folder. */
function archiveRaw(url: string, label: string, body: unknown): void {
  const entry = archiveEntry(url, label, body);
  const file = resolve(RESEARCH_DIR, rawArchivePath(label, entry.fetched_at));
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entry, null, 2)}
`);
}

/**
 * The balance, before and after. `usage/credits` is metered rather than billed,
 * and the difference across a run is the **only** cost figure that cannot be
 * wrong (`docs/X-API.md §1`). Everything else is a model.
 */
async function readBalance(token: string): Promise<number | null> {
  try {
    const body = await fetchJson<{ data?: { total_balance?: number } }>(
      CREDITS_URL,
      token,
      "usage-credits",
      false,
    );
    return body.data?.total_balance ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The incremental high-water mark
// ---------------------------------------------------------------------------

interface TrackAState {
  since_id: string;
  covered_through: string;
  last_run: string;
  runs: { at: string; since_id: string; posts: number; authors: number }[];
}

function loadState(): TrackAState | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as TrackAState;
}

/**
 * Written only after a successful sweep, and only ever forwards.
 *
 * A `since_id` that moves backwards re-buys a window already paid for; one that
 * moves forwards on a *failed* run silently skips posts nobody has seen. Both
 * are silent, so the write happens once, at the end, from the API's own
 * `newest_id`.
 */
function saveState(state: TrackAState): void {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Local inputs
// ---------------------------------------------------------------------------

function loadProfileStore(): Map<string, PaidProfile> {
  const store = new Map<string, PaidProfile>();
  if (!existsSync(PROFILE_STORE)) return store;
  mergeProfiles(store, collectUserObjects(JSON.parse(readFileSync(PROFILE_STORE, "utf-8"))));
  return store;
}

function loadLegislatorIndex(): Legislator[] {
  const current = resolve(LEGISLATORS_DIR, "legislators-current.csv");
  const historical = resolve(LEGISLATORS_DIR, "legislators-historical.csv");
  if (!existsSync(current) || !existsSync(historical)) {
    console.error("  legislator register not found — register matching is off for this run");
    return [];
  }
  return buildLegislatorIndex(readFileSync(current, "utf-8"), readFileSync(historical, "utf-8"));
}

/** The fullest text a post offers: `note_tweet` when longer, otherwise `text`. */
function fullPostText(tweet: ApiTweet): { text: string; truncated: boolean } {
  const stub = (tweet.text ?? "").trim();
  const raw = tweet.note_tweet;
  const note = (typeof raw === "string" ? raw : raw?.text) ?? "";
  if (note.trim().length > stub.length) return { text: note.trim(), truncated: true };
  return { text: stub, truncated: false };
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

/**
 * Size the window before paying to fetch it — $0.01 per 31 days of window.
 *
 * A count is a **price estimate and never a completion check**: on 2026-09-21
 * `counts` reported 28 for the window and the search returned 25 distinct
 * posts. Deleted posts and protected accounts sit in the gap, so a sweep that
 * pages until it reaches the advertised number pages forever (`docs/X-API.md §17`).
 *
 * **One response covers at most 31 days** (measured 2026-09-23, at $0.01 a
 * request). This used to read the first page only, so a window longer than a
 * month was priced as if it were one month. It now follows `next_token`, up to
 * MAX_SIZING_PAGES, and says so when it stops short.
 */
const MAX_SIZING_PAGES = 12;

async function sizeWindow(token: string, since: string): Promise<number> {
  const base = `${COUNTS_URL}?query=${encodeURIComponent(QUERY)}&${since}&granularity=day`;
  /*
   * Billed and therefore archived, which it was not until 2026-09-21. This
   * runs on every unqualified invocation — the default, cheapest, most
   * frequent mode — and its answer is the historical record of how big the
   * mention population was on a given day. That reading cannot be re-taken.
   */
  let total = 0;
  let pages = 0;
  let pageToken: string | undefined;
  const buckets: { start: string; tweet_count: number }[] = [];
  do {
    const body = await fetchJson<{
      data?: { start: string; tweet_count: number }[];
      meta?: { total_tweet_count?: number; next_token?: string };
    }>(pageToken ? `${base}&next_token=${pageToken}` : base, token, `counts-window-sizing-page-${pages + 1}`);
    total += body.meta?.total_tweet_count ?? 0;
    buckets.push(...(body.data ?? []));
    pageToken = body.meta?.next_token;
    pages++;
  } while (pageToken && pages < MAX_SIZING_PAGES);

  console.log(`\nwindow holds ${total} post(s) — ${pages} counts request(s), $${(pages * 0.01).toFixed(2)}`);
  if (pageToken) {
    console.log(`  stopped after ${MAX_SIZING_PAGES} pages: the window is longer and the figure is a floor.`);
  }
  for (const bucket of buckets) {
    if (bucket.tweet_count > 0) console.log(`  ${bucket.start.slice(0, 10)}  ${bucket.tweet_count}`);
  }

  // Authors ~= 0.85 x posts, measured across both tracks (docs/X-API.md §11).
  const posts = total * 0.005;
  const users = Math.round(total * 0.85) * 0.01;
  console.log(
    `\nestimated cost of a sweep: $${(posts + users).toFixed(2)} ` +
      `(${total} posts x $0.005 = $${posts.toFixed(2)}, ` +
      `~${Math.round(total * 0.85)} authors x $0.010 = $${users.toFixed(2)})`,
  );
  console.log("  a count prices a fetch; it never certifies that the fetch is complete.");
  return total;
}

interface Candidate {
  account: string;
  name: string;
  followers: number | null;
  verified_type: string | null;
  description: string;
  evidence_url: string;
  posted_at: string | null;
  post_text: string;
  text_recovered_from_note: boolean;
  flags: string[];
  register_matches: string[];
  /** What a human must confirm, and where. Verification is part of the track. */
  verify: string[];
}

async function sweep(
  token: string,
  since: string,
  known: Set<string>,
  store: Map<string, PaidProfile>,
  legislators: Legislator[],
): Promise<{ candidates: Candidate[]; pages: SearchPage[]; newestId: string | null; posts: number }> {
  const pages: SearchPage[] = [];
  const byAuthor = new Map<string, { tweet: ApiTweet; user: ApiUser }>();
  const seenPostIds = new Set<string>();
  let pageToken: string | undefined;
  let newestId: string | null = null;
  let barren = 0;

  for (let page = 0; page < maxPages; page += 1) {
    let url =
      `${SEARCH_URL}?query=${encodeURIComponent(QUERY)}&${since}` +
      `&max_results=${PAGE_SIZE}&sort_order=recency` +
      `&tweet.fields=${TWEET_FIELDS}&expansions=author_id&user.fields=${USER_FIELDS}`;
    if (pageToken) url += `&next_token=${pageToken}`;

    /*
     * `expansions=author_id` is kept here and deliberately NOT kept in
     * `sweep:quotes`. Track A is a one-to-three-page job where the same author
     * barely repeats — 245 user objects for 242 distinct authors on the full
     * run — so the expansion costs ~1% over a batched lookup and no candidate
     * can be judged without it. Track B pages dozens of times, where the same
     * economy runs the other way (docs/X-API.md §12).
     */
    const body = await fetchJson<SearchPage>(url, token, `search-all-page-${page + 1}`);
    pages.push(body);

    const tweets = body.data ?? [];
    const users = new Map((body.includes?.users ?? []).map((user) => [user.id, user]));
    if (body.meta?.newest_id && !newestId) newestId = body.meta.newest_id;

    // Every profile the expansion returned is paid for — bank it before
    // anything else can throw.
    mergeProfiles(store, collectUserObjects(body));
    writeFileSync(PROFILE_STORE, `${JSON.stringify([...store.values()], null, 2)}\n`);

    let fresh = 0;
    for (const tweet of tweets) {
      if (seenPostIds.has(tweet.id)) continue;
      seenPostIds.add(tweet.id);
      fresh += 1;
      if (!tweet.author_id) continue;
      const user = users.get(tweet.author_id);
      if (!user) continue;
      const held = byAuthor.get(tweet.author_id);
      // Keep the account's loudest post: one row per account to read.
      const signal = (metrics: ApiTweet) =>
        (metrics.public_metrics?.like_count ?? 0) + (metrics.public_metrics?.retweet_count ?? 0);
      if (!held || signal(tweet) > signal(held.tweet)) byAuthor.set(tweet.author_id, { tweet, user });
    }

    console.log(
      `  page ${page + 1}: ${tweets.length} entries (${fresh} new) · ` +
        `${byAuthor.size} distinct authors`,
    );

    pageToken = body.meta?.next_token;
    if (!pageToken) break;
    // The quote endpoint re-issues a token forever (docs/X-API.md §17). Search
    // has not been seen to, but the same guard costs nothing and the failure it
    // prevents is an entire rate window.
    barren = fresh === 0 ? barren + 1 : 0;
    if (barren >= 2) {
      console.log("  stopping: two consecutive pages added nothing new.");
      break;
    }
  }

  const candidates: Candidate[] = [];
  for (const { tweet, user } of byAuthor.values()) {
    const account = `@${user.username.toLowerCase()}`;
    if (known.has(account)) continue;
    const followers = user.public_metrics?.followers_count ?? 0;
    const flags = signalFlags(user);
    const matches = matchLegislators(
      { name: user.name, username: user.username, authorId: user.id },
      legislators,
    );
    for (const match of matches) {
      flags.push(
        `register-match (${match.matchedOn}): ${match.legislator.fullName}, ` +
          `${match.legislator.chamber}-${match.legislator.state}, ${match.legislator.era}`,
      );
    }
    // Below the reading floor and carrying no signal at all: enumerated, kept in
    // the report, not put in front of a human.
    if (followers < READING_FLOOR && flags.length === 0) continue;

    const text = fullPostText(tweet);
    candidates.push({
      account: `@${user.username}`,
      name: user.name,
      followers,
      verified_type: user.verified_type ?? null,
      description: (user.description ?? "").replace(/\s+/g, " ").trim(),
      evidence_url: `https://x.com/${user.username}/status/${tweet.id}`,
      posted_at: tweet.created_at ? tweet.created_at.slice(0, 10) : null,
      post_text: text.text,
      text_recovered_from_note: text.truncated,
      flags,
      register_matches: matches.map((match) => match.legislator.fullName),
      verify: verificationClaims(user, flags),
    });
  }

  candidates.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
  return { candidates, pages, newestId, posts: seenPostIds.size };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const token = loadBearerToken();
  const amplifications = amplificationsFileSchema.parse(
    JSON.parse(readFileSync(resolve(DATA_DIR, "amplifications.json"), "utf-8")),
  );
  const known = knownAccountKeys(amplifications);
  const store = loadProfileStore();
  const legislators = loadLegislatorIndex();
  const state = loadState();

  const sinceId = sinceIdArg ?? state?.since_id ?? null;
  const since = startTimeArg
    ? `start_time=${startTimeArg}`
    : sinceId
      ? `since_id=${sinceId}`
      : null;

  if (!since) {
    console.error(
      "No window given. Pass --since-id <id> or --start-time <ISO>, or run once to create\n" +
        `${STATE_FILE}. Without one this would sweep the whole archive and bill for it.`,
    );
    process.exit(1);
  }

  console.log(
    `${amplifications.length} amplification records · ${known.size} accounts already known · ` +
      `${store.size} profiles already paid for${isDryRun ? " · DRY RUN" : ""}`,
  );
  console.log(`window: ${since}${state ? ` (covered through ${state.covered_through})` : ""}`);

  const before = await readBalance(token);
  if (before !== null) console.log(`balance before: $${before.toFixed(2)}`);

  const total = await sizeWindow(token, since);

  if (!doSweep) {
    console.log("\nSizing only — nothing was swept. Re-run with `--sweep` to fetch and profile.");
    const after = await readBalance(token);
    if (before !== null && after !== null) {
      console.log(`balance after:  $${after.toFixed(2)}  (spent $${(before - after).toFixed(2)})`);
    }
    return;
  }

  if (total === 0) {
    console.log("\nNothing in the window. Not sweeping.");
    return;
  }

  const { candidates, pages, newestId, posts } = await sweep(token, since, known, store, legislators);

  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10);
  const outDir = resolve(RESEARCH_DIR, `x-api-${day}`);
  if (!isDryRun) {
    mkdirSync(outDir, { recursive: true });
    // The raw bodies are the paid evidence; a missing field and an ignored
    // request look identical once the response is parsed away (§15).
    writeFileSync(
      resolve(outDir, `track-a-raw-${stamp.slice(11, 19).replace(/:/g, "")}.json`),
      JSON.stringify({ fetched_at: stamp, query: QUERY, window: since, pages }, null, 2),
    );
    writeFileSync(
      resolve(outDir, "track-a-report.json"),
      JSON.stringify({ swept_at: stamp, query: QUERY, window: since, posts, candidates }, null, 2),
    );
  }

  console.log(`\n${posts} distinct post(s) · ${candidates.length} candidate(s) to read`);
  for (const candidate of candidates) {
    console.log(`\n  ${candidate.account}  ${candidate.name}  (${candidate.followers} followers)`);
    if (candidate.flags.length > 0) console.log(`    ${candidate.flags.join(" · ")}`);
    console.log(`    ${candidate.evidence_url}  (${candidate.posted_at})`);
    console.log(`    "${candidate.post_text.replace(/\s+/g, " ").slice(0, 150)}"`);
    console.log("    must verify before recording:");
    for (const claim of candidate.verify) console.log(`      - ${claim}`);
  }

  if (newestId && !isDryRun) {
    saveState({
      since_id: newestId,
      covered_through: day,
      last_run: stamp,
      runs: [
        ...(state?.runs ?? []),
        { at: stamp, since_id: sinceId ?? "(start_time)", posts, authors: candidates.length },
      ],
    });
    console.log(`\nnext incremental starts at since_id = ${newestId}`);
  }

  const after = await readBalance(token);
  if (before !== null && after !== null) {
    console.log(`balance after: $${after.toFixed(2)}  (spent $${(before - after).toFixed(2)})`);
  }

  console.log(
    "\nA flag is NOT a verification. Confirm each claim above against a source that is not the\n" +
      "account, then write the record by hand (docs/DATA.md §6). Nothing here was written to data/.",
  );
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
