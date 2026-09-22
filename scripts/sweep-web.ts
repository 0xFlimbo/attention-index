/**
 * pnpm sweep:web [-- --sweep] [-- --query <label>] [-- --max-queries N]
 *                [-- --count N] [-- --freshness py] [-- --extra-snippets]
 *                [-- --pages N]   # up to N pages per query, only where one exists
 * pnpm sweep:web -- --sweep --fetch   # chain the free verification stage onto the run
 * pnpm sweep:web -- --yield            # per-query yield from the ledger; no request
 *
 * **B11's discovery half** (docs/WORKPLAN.md B11, docs/ENGINEERING.md §21):
 * ask a web-search index which pages name this project or carry the claims its
 * work produced, diff every returned URL against `data/media.json`, and hand a
 * human a queue of pages to read. Nothing in this repo queried a search engine
 * before; this is the only genuinely new capability in the batch.
 *
 * ---------------------------------------------------------------------------
 * **Read-only against `data/`, like every discovery tool here.** It reports
 * candidates and writes a URL list; a human fetches them with
 * `pnpm check:media-mentions --urls`, opens the ones that hit, reads them, and
 * writes the record. A hit of a string is not a verification and a sweep is
 * not a promotion.
 *
 * **Planning is the default and spending is opt-in.** An unqualified run makes
 * **zero** requests: it prints the query set, what it would cost and what it
 * would ask. Only `--sweep` bills. This mirrors `sweep:mentions`, where a
 * mistyped flag costs a cent rather than a sweep.
 *
 * **The billing exposure this is designed against.** Brave withdrew its free
 * plan in February 2026: the account carries a card, $5 of credit arrives each
 * month (≈1,000 queries at $5/1,000), and **there is no default spending cap**
 * — once the credit is gone the card is billed. So: a hard ceiling of
 * `HARD_QUERY_CAP` queries per run that no flag can raise, one request at a
 * time with a pause between them, and **abort on the first non-200** rather
 * than retry. A runaway loop is the failure mode worth designing against, not
 * the price of a sweep. Set a cap in the vendor dashboard as well; a script's
 * ceiling protects against this script only.
 *
 * **Metering, in the shape `docs/X-API.md §1` requires.** There is no balance
 * endpoint here, so the meter is what the response itself reports: every
 * response's headers are archived, and the rate-limit/quota headers are
 * printed before and after the run. **Those header names are not yet verified
 * against a live response** — this project has never made a billed call to
 * this API — so the client keeps *all* headers rather than the ones it expects,
 * and the first metered run either confirms the names below or corrects them.
 * Until then the printed dollar figure is a **model** ($0.005 × queries), not a
 * measurement, and it is labelled as one.
 *
 * **The vendor publishes no OpenAPI specification.** Six candidate paths were
 * probed on 2026-09-22 and every one 404s or 403s; the reference site is an
 * application that embeds no spec URL, and the vendor's own skills repository
 * carries prose files rather than a schema. So the rule `docs/X-API.md §0`
 * sets — read the spec, believe it over our notes — has nothing to point at
 * here, and the nearest thing is kept instead: dated copies of the vendor's
 * own parameter reference in
 * `research/brave-search-2026-09-22/reference/`. Every parameter below was
 * checked against it. There is nothing for `tests/api-field-validity.test.ts`
 * to validate against, which is a gap worth knowing rather than closing.
 *
 * Credentials: `BRAVE_SEARCH_API_KEY` is read from `.env.local` and travels in
 * the `X-Subscription-Token` header. It is never logged, echoed or written
 * anywhere, including into the archive (`docs/ENGINEERING.md §8`).
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { mediaFileSchema } from "../src/schemas/media.schema";
import { archiveEntry, rawArchivePath } from "../src/lib/sweep/raw-archive";
import {
  buildKnownUrlIndex,
  classifyResult,
  countByVerdict,
  dedupeResults,
  type ClassifiedResult,
} from "../src/lib/sweep/web-search-results";
import {
  QUERY_SET_VERSION,
  allQueryLabels,
  selectQueries,
  type SweepQuery,
} from "../src/lib/sweep/web-queries";
import {
  emptyLedger,
  fetchOutcome,
  ledgerEntry,
  summarise,
  yieldByQuery,
  type FetchOutcome,
  type Ledger,
} from "../src/lib/sweep/cost-ledger";
import { probePage, sleep, type ProbeResult } from "../src/lib/sweep/page-probe";
import {
  advanceMarks,
  emptySweepState,
  planFreshness,
  type SweepState,
} from "../src/lib/sweep/sweep-state";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const RESEARCH_DIR = resolve(ROOT, "research");
/**
 * Accumulating across every run, never a dated snapshot: it is the record of
 * spend, and `research/README.md` calls that the one class of file here that
 * can never be regenerated.
 */
const LEDGER_FILE = resolve(RESEARCH_DIR, "brave-search-ledger.json");
/** Per-query high-water marks, so a repeat sweep does not re-buy the archive. */
const STATE_FILE = resolve(RESEARCH_DIR, "web-sweep-state.json");

const SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
/** $5 per 1,000 web-search queries, vendor pricing page, 2026-09-22. */
const PRICE_PER_QUERY = 0.005;
/**
 * No flag raises this. It is the ceiling on what one mistake can cost: at
 * $0.005 a query, a full run of the ceiling is $0.30 and the monthly credit
 * absorbs it many times over.
 */
const HARD_QUERY_CAP = 60;
/** The base plan is one query per second; a burst is a 429, which aborts. */
const QUERY_DELAY_MS = 1_200;

/**
 * The headers worth printing, if they exist. Unverified — see the file header.
 * Anything else the response carries is in the archived raw file regardless.
 */
const METER_HEADER_PREFIXES = ["x-ratelimit", "x-quota", "x-request"];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const doSweep = args.includes("--sweep");
const queryFilter = flagValue("query");
const maxQueries = Math.min(Number(flagValue("max-queries") ?? HARD_QUERY_CAP), HARD_QUERY_CAP);
/** Brave's web search returns at most 20 results per query. */
const resultCount = Math.min(Number(flagValue("count") ?? 20), 20);
/** Optional recency filter: `pd`/`pw`/`pm`/`py` or `YYYY-MM-DDtoYYYY-MM-DD`. */
const freshness = flagValue("freshness");
const extraSnippets = args.includes("--extra-snippets");
/** Reads the ledger and prints per-query yield. Makes no request. */
const showYield = args.includes("--yield");
/**
 * Run the free verification stage on this run's candidates straight away.
 *
 * It costs nothing — the pages are fetched from their publishers, not from the
 * search vendor — and it is the difference between a run that ends with "46
 * candidates" and one that ends with "5 pages that name us". The two stages
 * stay separable on purpose: `check:media-mentions -- --urls` still works on
 * any list, and this only chains them.
 */
const doFetch = args.includes("--fetch");
/** Publishers throttle a burst, and a throttled page reads as a blocked one. */
const fetchDelayMs = Number(flagValue("fetch-delay") ?? 2_000);
/**
 * How many pages of results a query may buy, at one billed request each.
 *
 * Default 1, because most queries have no second page: measured over the first
 * full sweep, **10 of 13 were exhausted at page 1** and only `brand-closed`,
 * `daily-wire-layoffs` and `investigation-trine` reported more. A page is only
 * bought when the previous page's `more_results_available` says one exists, so
 * raising this cannot pay for empty pages — the vendor caps `offset` at 9.
 */
const maxPages = Math.min(Number(flagValue("pages") ?? 1), 10);
/**
 * Restrict each query to what is new since that query was last swept.
 *
 * This is the cadence lever B12 needs: the first sweep pays for the back
 * catalogue, every later one pays only for the delta. A query the state has
 * never seen — new, or reworded since — is swept unrestricted anyway, because
 * a window applied to a query that has never seen the archive reports a clean
 * nothing while skipping everything.
 */
const sinceLast = args.includes("--since-last");

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/** Reads the key from .env.local without ever logging it. */
function loadSearchKey(): string {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found. Create it from .env.example and set BRAVE_SEARCH_API_KEY.");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^BRAVE_SEARCH_API_KEY=(.*)$/);
    if (match) {
      const key = match[1]?.trim() ?? "";
      if (key.length > 0) return key;
      break;
    }
  }
  console.error(
    "BRAVE_SEARCH_API_KEY is missing or empty in .env.local.\n" +
      "This script never registers an account and never buys anything: add the key by hand,\n" +
      "set a spending cap in the vendor dashboard first, then run it again.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The API
// ---------------------------------------------------------------------------

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
}

interface BraveResponse {
  query?: { more_results_available?: boolean };
  web?: { results?: BraveResult[] };
  /**
   * The news vertical, read as well as `web`. A media-citation sweep is
   * looking for articles, and the vendor returns news results in their own
   * array rather than inside `web.results` — reading only `web` would drop
   * exactly the population B11 exists to find.
   */
  news?: { results?: BraveResult[] };
}

interface QueryOutcome {
  query: SweepQuery;
  httpStatus: number;
  /** The vendor's own word on whether a further page exists. */
  moreAvailable: boolean;
  results: ClassifiedResult[];
  headers: Record<string, string>;
  error?: string;
}

function meterHeaders(headers: Headers): Record<string, string> {
  const kept: Record<string, string> = {};
  headers.forEach((value, name) => {
    // Everything is archived; a credential never travels in a response header
    // we print, but the filter keeps the console readable either way.
    kept[name.toLowerCase()] = value;
  });
  return kept;
}

function printMeter(label: string, headers: Record<string, string>): void {
  const lines = Object.entries(headers).filter(([name]) =>
    METER_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix)),
  );
  if (lines.length === 0) {
    console.log(`  ${label}: no rate-limit headers in the response (see the archived raw file)`);
    return;
  }
  for (const [name, value] of lines) console.log(`  ${label}: ${name}: ${value}`);
}

/**
 * Appends one billed request to the ledger, immediately.
 *
 * Written per request rather than per run, so a run that aborts halfway still
 * records what it spent getting there — which is exactly the run whose cost
 * would otherwise be guessed at later.
 */
function appendLedger(entry: ReturnType<typeof ledgerEntry>): void {
  const ledger: Ledger = existsSync(LEDGER_FILE)
    ? (JSON.parse(readFileSync(LEDGER_FILE, "utf-8")) as Ledger)
    : emptyLedger("brave-search");
  ledger.entries.push(entry);
  mkdirSync(RESEARCH_DIR, { recursive: true });
  writeFileSync(LEDGER_FILE, `${JSON.stringify(ledger, null, 2)}
`);
}

/** Appends the free verification stage's outcome, which never touches spend. */
function appendFetchOutcomes(outcomes: FetchOutcome[]): void {
  const ledger: Ledger = existsSync(LEDGER_FILE)
    ? (JSON.parse(readFileSync(LEDGER_FILE, "utf-8")) as Ledger)
    : emptyLedger("brave-search");
  ledger.fetches = [...(ledger.fetches ?? []), ...outcomes];
  writeFileSync(LEDGER_FILE, `${JSON.stringify(ledger, null, 2)}
`);
}

/** Writes one archived response under `research/`, creating the dated folder. */
function archiveRaw(url: string, label: string, body: unknown): string {
  const entry = archiveEntry(url, label, body);
  const file = resolve(RESEARCH_DIR, rawArchivePath(label, entry.fetched_at, "brave-search"));
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
  return file;
}

/**
 * One billed query. The body and the headers are archived **before** anything
 * reads a field off them: a request that was misunderstood and a field that is
 * genuinely absent look identical once the response has been parsed away, and
 * this is the first call this project has ever made to this vendor
 * (`docs/ENGINEERING.md §18c`).
 */
async function runQuery(
  query: SweepQuery,
  key: string,
  known: Set<string>,
  offset = 0,
  freshnessOverride: string | null = null,
): Promise<QueryOutcome> {
  /*
   * Checked parameter by parameter against the vendor's own reference on
   * 2026-09-22 (`research/brave-search-2026-09-22/reference/`), because this
   * client was first written without it:
   *
   * - `count` is capped at 20 by the vendor, which is why `resultCount` is.
   * - `spellcheck` is a boolean and is sent as `false`, not `0`. An unknown
   *   *value* is the class of bug that cost this project a paid page on the
   *   other API (`docs/X-API.md §16`), and "0" is not in the documented set.
   * - `text_decorations=false` strips the highlight markers the vendor
   *   otherwise injects into `description`. They are markup inside the text
   *   this sweep string-matches, so leaving them on corrupts the input.
   * - `result_filter` keeps the two verticals that can carry an article and
   *   drops videos, FAQs, discussions and infoboxes.
   * - operators (`"exact phrase"`, `-site:`) are applied by default, so the
   *   query set needs no extra parameter to mean what it says.
   */
  const params = new URLSearchParams({
    q: query.q,
    count: String(resultCount),
    country: "us",
    search_lang: "en",
    spellcheck: "false",
    text_decorations: "false",
    result_filter: "web,news",
  });
  const window = freshnessOverride ?? freshness;
  if (window !== null) params.set("freshness", window);
  if (offset > 0) params.set("offset", String(offset));
  // Up to five further excerpts per result, and plausibly plan-gated: opt-in,
  // because an unsupported parameter would abort the run on its first query.
  if (extraSnippets) params.set("extra_snippets", "true");

  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip",
      "x-subscription-token": key,
    },
  });

  const headers = meterHeaders(response.headers);
  const text = await response.text();

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = { unparseable_body: text.slice(0, 2_000) };
  }
  archiveRaw(SEARCH_URL, `web-search-${query.label}${offset > 0 ? `-p${offset + 1}` : ""}`, {
    headers,
    status: response.status,
    body,
  });

  const payload = body as BraveResponse;
  const parsed = [...(payload.web?.results ?? []), ...(payload.news?.results ?? [])];
  // Classified here rather than in the caller so the ledger entry can carry the
  // verdict counts: per-query yield then measures itself run after run instead
  // of being reconstructed by hand from two reports.
  const classified = parsed.map((result) =>
    classifyResult(
      {
        title: result.title ?? "",
        url: result.url ?? "",
        description: result.description,
        age: result.age ?? result.page_age,
        query: query.q,
        queryLabel: query.label,
      },
      known,
    ),
  );

  appendLedger(
    ledgerEntry({
      at: new Date().toISOString(),
      vendor: "brave-search",
      endpoint: "/res/v1/web/search",
      querySetVersion: QUERY_SET_VERSION,
      queryLabel: query.label,
      q: query.q,
      offset,
      httpStatus: response.status,
      resultCount: classified.length,
      unitPriceUsd: PRICE_PER_QUERY,
      headers,
      verdicts: countByVerdict(classified),
    }),
  );

  if (!response.ok) {
    return {
      query,
      httpStatus: response.status,
      moreAvailable: false,
      results: [],
      headers,
      error: text.slice(0, 300),
    };
  }

  return {
    query,
    httpStatus: response.status,
    moreAvailable: payload.query?.more_results_available === true,
    headers,
    results: classified,
  };
}

// ---------------------------------------------------------------------------
// Local input
// ---------------------------------------------------------------------------

function knownUrls(): Set<string> {
  const raw = JSON.parse(readFileSync(resolve(DATA_DIR, "media.json"), "utf-8")) as unknown;
  const parsed = mediaFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("data/media.json failed schema validation — run `pnpm validate:data` first.");
    process.exit(1);
  }
  return buildKnownUrlIndex(parsed.data);
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function printPlan(queries: SweepQuery[]): void {
  console.log(`query set ${QUERY_SET_VERSION} · ${queries.length} queries · ${resultCount} results each`);
  console.log(
    `modelled cost ${(queries.length * PRICE_PER_QUERY).toFixed(3)} USD ` +
      `(${queries.length} × $${PRICE_PER_QUERY}) — a model, not a meter` +
      `${maxPages > 1 ? `, and up to ${maxPages}× that if every query has ${maxPages} pages` : ""}\n`,
  );
  for (const query of queries) {
    console.log(`  ${query.label.padEnd(30)} [${query.cluster}]`);
    console.log(`    q: ${query.q}`);
    console.log(`    why: ${query.why}`);
  }
}

function writeReport(
  outcomes: QueryOutcome[],
  classified: ClassifiedResult[],
): { report: string; urls: string } {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const time = now.slice(11, 19).replace(/:/g, "");
  const dir = resolve(RESEARCH_DIR, `brave-search-${day}`);
  mkdirSync(dir, { recursive: true });

  const report = resolve(dir, `sweep-${time}.json`);
  writeFileSync(
    report,
    `${JSON.stringify(
      {
        swept_at: now,
        query_set_version: QUERY_SET_VERSION,
        queries: outcomes.map((outcome) => ({
          label: outcome.query.label,
          cluster: outcome.query.cluster,
          q: outcome.query.q,
          http_status: outcome.httpStatus,
          result_count: outcome.results.length,
          error: outcome.error,
        })),
        modelled_cost_usd: Number((outcomes.length * PRICE_PER_QUERY).toFixed(4)),
        results: classified,
      },
      null,
      2,
    )}\n`,
  );

  // The handoff to stage two: exactly the shape `check:media-mentions --urls`
  // reads, so the next command is a copy-paste and not a transcription.
  const urls = resolve(dir, `candidate-urls-${time}.txt`);
  const candidates = classified.filter((result) => result.verdict === "candidate");
  writeFileSync(
    urls,
    [
      `# Web sweep ${now} · query set ${QUERY_SET_VERSION}`,
      `# ${candidates.length} candidate(s). Fetch with:`,
      `#   pnpm check:media-mentions -- --urls research/brave-search-${day}/candidate-urls-${time}.txt`,
      "# A hit is not a verification. Open and read the article before writing a record.",
      "",
      ...candidates.map((result) => `${result.url}  ${result.host}`),
      "",
    ].join("\n"),
  );

  return { report, urls };
}

/**
 * The free half: fetch every candidate and see whether the page names us.
 *
 * Costs nothing — these are publishers, not the search vendor — and it is what
 * turns "46 candidates" into "5 pages that name this project". It is still not
 * a verification: a brand form on a page is a reason to open the article, and
 * the article is what a record is written from.
 */
async function verifyCandidates(
  candidates: ClassifiedResult[],
  dir: string,
  time: string,
): Promise<ProbeResult[]> {
  console.log(`\nFetching ${candidates.length} candidate(s) — free, ${fetchDelayMs}ms apart\n`);

  const pagesDir = resolve(dir, `pages-${time}`);
  const results: ProbeResult[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const result = await probePage(
      { id: `${String(index + 1).padStart(2, "0")}-${candidate.host}`, publication: candidate.host, url: candidate.url },
      {
        useProxy: true,
        saveText: (target, text) => {
          mkdirSync(pagesDir, { recursive: true });
          writeFileSync(resolve(pagesDir, `${target.id}.txt`), [target.url, "", text, ""].join("\n"));
          return `${target.id}.txt`;
        },
      },
    );
    results.push(result);
    console.log(
      `${String(index + 1).padStart(3)}/${candidates.length}  ` +
        `${String(result.httpStatus).padStart(3)}  ` +
        `${result.mentions.brand ? "BRAND" : result.mentions.total > 0 ? "weak " : "  -  "}  ` +
        `${candidate.host}`,
    );
    if (index < candidates.length - 1) await sleep(fetchDelayMs);
  }

  return results;
}

function loadState(): SweepState {
  if (!existsSync(STATE_FILE)) return emptySweepState();
  return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as SweepState;
}

function saveState(state: SweepState): void {
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

async function sweep(queries: SweepQuery[], key: string): Promise<void> {
  const known = knownUrls();
  const outcomes: QueryOutcome[] = [];
  const state = loadState();
  const today = new Date().toISOString();

  const plan = sinceLast ? planFreshness(queries, state, today) : [];
  if (sinceLast) {
    console.log("Incremental — each query restricted to what is new since it was last swept:\n");
    for (const row of plan) {
      console.log(`  ${row.label.padEnd(30)} ${row.reason}`);
    }
    console.log("");
  }
  const windowFor = (label: string): string | null =>
    plan.find((row) => row.label === label)?.freshness ?? null;
  /** Only the queries that actually answered 200 may advance their mark. */
  const succeeded: SweepQuery[] = [];

  /*
   * Pages count against the ceiling, not queries. `--pages 10` on a 13-query
   * set could otherwise ask for 130 requests while `HARD_QUERY_CAP` waved it
   * through on a count of 13 — the ceiling exists to bound what one mistake
   * costs, so it has to bound the thing that is actually billed.
   */
  let requests = 0;
  let aborted = false;

  for (const [index, query] of queries.entries()) {
    for (let page = 0; page < maxPages; page++) {
      if (requests >= HARD_QUERY_CAP) {
        console.error(`\nCeiling of ${HARD_QUERY_CAP} requests reached — stopping the run.`);
        aborted = true;
        break;
      }

      const outcome = await runQuery(query, key, known, page, windowFor(query.label));
      requests += 1;
      outcomes.push(outcome);
      if (outcome.httpStatus === 200 && page === 0) succeeded.push(query);

      if (requests === 1) printMeter("meter before", outcome.headers);

      if (outcome.httpStatus !== 200) {
        // Abort rather than retry: a loop against an API with no spending cap
        // is the one failure mode that can cost real money.
        console.error(
          `\n${query.label}: HTTP ${outcome.httpStatus} — aborting the run.\n` +
            `  ${outcome.error ?? ""}\n` +
            "  The response is archived. Nothing further was requested.",
        );
        aborted = true;
        break;
      }

      console.log(
        `${String(index + 1).padStart(2)}/${queries.length}  ` +
          `${String(outcome.results.length).padStart(2)} result(s)  ${query.label}` +
          `${page > 0 ? `  (page ${page + 1})` : ""}` +
          `${outcome.moreAvailable && page + 1 >= maxPages ? "  — more available" : ""}`,
      );
      if (outcome.results.length === 0) {
        console.log("      no results parsed — check the archived raw body for a shape change");
      }

      // Never buy a page the vendor has not said exists.
      if (!outcome.moreAvailable) break;
      await new Promise((done) => setTimeout(done, QUERY_DELAY_MS));
    }

    if (aborted) break;
    if (index < queries.length - 1) await new Promise((done) => setTimeout(done, QUERY_DELAY_MS));
  }

  const last = outcomes.at(-1);
  if (last !== undefined) printMeter("meter after ", last.headers);

  const classified = dedupeResults(outcomes.flatMap((outcome) => outcome.results));
  const counts = countByVerdict(classified);
  const billed = outcomes.length;

  const { report, urls } = writeReport(outcomes, classified);

  console.log("\n--- summary ---------------------------------------------");
  console.log(`requests billed               ${billed}  (pages, not queries)`);
  console.log(`modelled cost                 $${(billed * PRICE_PER_QUERY).toFixed(3)} (a model)`);
  console.log(`distinct URLs                 ${classified.length}`);
  console.log(`  already in media.json       ${counts.known}`);
  console.log(`  the project's own surfaces  ${counts.self}`);
  console.log(`  no reporting of its own     ${counts.no_reporting}  (archive on sight)`);
  console.log(`  candidates                  ${counts.candidate}`);

  for (const result of classified.filter((entry) => entry.verdict === "candidate")) {
    console.log(`\n  ${result.host}  [${result.queryLabel}]`);
    console.log(`    ${result.title.slice(0, 120)}`);
    console.log(`    ${result.url}`);
  }

  /** Real hits from this run's verification stage, for the state's run log. */
  let fetchedHits: number | null = null;

  if (doFetch && counts.candidate > 0) {
    const candidates = classified.filter((entry) => entry.verdict === "candidate");
    const day = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 19).replace(/:/g, "");
    const dir = resolve(RESEARCH_DIR, `brave-search-${day}`);
    const probed = await verifyCandidates(candidates, dir, time);

    const byUrl = new Map(probed.map((result) => [result.url, result]));
    const byQuery = new Map<string, ProbeResult[]>();
    for (const candidate of candidates) {
      const result = byUrl.get(candidate.url);
      if (result === undefined) continue;
      byQuery.set(candidate.queryLabel, [...(byQuery.get(candidate.queryLabel) ?? []), result]);
    }
    appendFetchOutcomes(
      [...byQuery.entries()].map(([queryLabel, results]) =>
        fetchOutcome({
          at: new Date().toISOString(),
          queryLabel,
          querySetVersion: QUERY_SET_VERSION,
          results,
        }),
      ),
    );

    const hits = probed.filter((result) => result.mentions.brand);
    fetchedHits = hits.length;
    const weak = probed.filter((result) => !result.mentions.brand && result.mentions.total > 0);
    console.log("\n--- verification (free) ---------------------------------");
    console.log(`fetched                       ${probed.filter((r) => r.httpStatus === 200).length}/${probed.length}`);
    console.log(`  brand form on the page      ${hits.length}`);
    console.log(`  weak form only              ${weak.length}`);
    for (const hit of hits) {
      const source = candidates.find((entry) => entry.url === hit.url);
      console.log(`\n  ${hit.publication}  [${source?.queryLabel ?? "?"}]`);
      console.log(`    ${hit.url}`);
      const excerpt = hit.mentions.excerpts[0];
      if (excerpt !== undefined) console.log(`    ${excerpt.slice(0, 200)}`);
    }
    if (weak.length > 0) {
      console.log("\n  Weak form only — a reason to read the page, never a reference:");
      for (const result of weak) console.log(`    ${result.publication}  ${result.url}`);
    }
    console.log(`\n  page text  ${resolve(dir, `pages-${time}`)}`);
    console.log(
      "\n  A brand form is not a verification. Open and read the article before writing\n" +
        "  a record, and archive on sight anything carrying no reporting of its own.",
    );
  }

  /*
   * The marks move last, and only for the queries that answered 200 on their
   * first page. Written even when this run did not use `--since-last`: the
   * mark records what has been looked at, and this run looked at it.
   */
  if (succeeded.length > 0) {
    const advanced = advanceMarks(state, succeeded, today);
    advanced.runs = [
      ...state.runs,
      {
        at: today,
        querySetVersion: QUERY_SET_VERSION,
        requests: billed,
        candidates: counts.candidate,
        brandHits: fetchedHits,
      },
    ];
    saveState(advanced);
    console.log(
      `\nmarks advanced                ${succeeded.length} quer(ies) → ${today.slice(0, 10)}`,
    );
    console.log(`  ${STATE_FILE}`);
    console.log("  Next run with --since-last buys only what is new since today.");
  }

  if (existsSync(LEDGER_FILE)) {
    const total = summarise((JSON.parse(readFileSync(LEDGER_FILE, "utf-8")) as Ledger).entries);
    console.log(
      `\nledger to date                ${total.requests} request(s) · ` +
        `$${total.modelledCostUsd.toFixed(3)} modelled · ` +
        `${total.resultsPerRequest} results per request`,
    );
    console.log(`  ${LEDGER_FILE}`);
    console.log(
      "  Modelled, not metered: the vendor publishes no balance endpoint, so the dashboard's\n" +
        "  own usage figure is the only true meter. Compare it against the request count above.",
    );
  }

  console.log(`\nreport      ${report}`);
  console.log(`URL list    ${urls}`);
  console.log(
    "\nNext: pnpm check:media-mentions -- --urls <the list above>, then open and read\n" +
      "every page that hits. A brand form on a page is a reason to read it, never a\n" +
      "record. A result with no reporting of its own is archived on sight.",
  );
  console.log(
    "\nCalibration: a full run must re-find the two pages confirmed by hand on\n" +
      "2026-09-22 — the yourNEWS 2026-06-07 piece and the NewsBreak syndication of\n" +
      "The American Bazaar's Trine investigation. A sweep that misses them has a\n" +
      "problem in the query set or the detector, not a finding about the world.",
  );
}

/**
 * Per-query yield across every run ever made, straight from the ledger.
 *
 * The point of the table is retirement: a query that has cost money across
 * several runs and returned neither a known record nor a candidate is dead
 * weight, and until this existed that could only be noticed by someone
 * joining two reports by hand.
 */
function printYield(): void {
  if (!existsSync(LEDGER_FILE)) {
    console.log("No ledger yet — nothing has been billed to this vendor.");
    return;
  }
  const ledger = JSON.parse(readFileSync(LEDGER_FILE, "utf-8")) as Ledger;
  const rows = yieldByQuery(ledger.entries, ledger.fetches ?? []);
  const total = summarise(ledger.entries);

  console.log(
    `ledger: ${total.requests} request(s) · $${total.modelledCostUsd.toFixed(3)} modelled · ` +
      `${total.firstAt?.slice(0, 10) ?? "?"} → ${total.lastAt?.slice(0, 10) ?? "?"}\n`,
  );
  console.log(
    `${"query".padEnd(30)}${"runs".padStart(5)}${"results".padStart(9)}` +
      `${"known".padStart(7)}${"cand".padStart(6)}${"hits".padStart(6)}${"$".padStart(8)}  query set`,
  );
  for (const row of rows) {
    console.log(
      `${row.queryLabel.padEnd(30)}${String(row.requests).padStart(5)}` +
        `${String(row.results).padStart(9)}${String(row.known).padStart(7)}` +
        `${String(row.candidates).padStart(6)}` +
        `${(row.brandHits === null ? "—" : String(row.brandHits)).padStart(6)}` +
        `${row.modelledCostUsd.toFixed(3).padStart(8)}  ` +
        `${row.reworded ? "REWORDED — totals span different questions; " : ""}` +
        row.querySetVersions.join(", "),
    );
  }
  console.log(
    "\nknown is not waste: a query that keeps returning records already in the file is the\n" +
      "control that tells a zero-candidate run apart from an index that has never heard of us.\n" +
      "Verdicts and the sent query were added mid-afternoon on 2026-09-22: runs before\n" +
      "that show zeros in both columns and cannot be flagged REWORDED, because a field\n" +
      "cannot appear in a file that was already written.",
  );
}

async function main(): Promise<void> {
  if (showYield) {
    printYield();
    return;
  }

  const selection = selectQueries(queryFilter !== null ? [queryFilter] : []);

  // An unknown label spends nothing and prints the list instead. Guessing at a
  // label against an API with no spending cap is not worth charging for.
  if (selection.unknown.length > 0) {
    console.error(`Unknown query label(s): ${selection.unknown.join(", ")}`);
    console.error(`Available: ${allQueryLabels().join(", ")}`);
    process.exit(1);
  }

  const queries = selection.queries.slice(0, maxQueries);
  if (queries.length === 0) {
    console.log("No query selected. Run without --query to see the whole set.");
    return;
  }

  printPlan(queries);

  if (!doSweep) {
    console.log("\nPlanning only — no request was made and nothing was billed.");
    console.log("Add --sweep to run it. Set a spending cap in the vendor dashboard first.");
    return;
  }

  if (queries.length > HARD_QUERY_CAP) {
    console.error(`Refusing to run ${queries.length} queries: the ceiling is ${HARD_QUERY_CAP}.`);
    process.exit(1);
  }

  console.log(`\nSweeping ${queries.length} quer(ies) — this spends.\n`);
  await sweep(queries, loadSearchKey());
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
