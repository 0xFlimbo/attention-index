/**
 * The search indexes `pnpm sweep:web` can ask, and everything that differs
 * between them: where the request goes, how it is shaped, how the answer is
 * read, what it costs, and where its spend and its marks are kept.
 *
 * ---------------------------------------------------------------------------
 * **Why there are two, and why they sit side by side rather than one replacing
 * the other.** Measured 2026-09-23 (`docs/WORKPLAN.md` B11, "The Serper
 * experiment"): of Brave's six real or calibration finds, Google returned one;
 * Google News returned one citing publication Brave never did. Neither index
 * contains the other on this project's long tail. Brave's web search stays the
 * default; Serper's `/news` runs alongside it, and Google web search is not
 * offered at all, because it returned nothing Brave lacked except noise.
 *
 * **A query set version names the questions, not the index they were put
 * to.** The same `q` sent to two vendors keeps its `QUERY_SET_VERSION`; what
 * keeps the two apart is that every vendor here has its own ledger, its own
 * raw-archive folder and its own `--since-last` state file. Sharing a state
 * file would let one index's date window a query the other has never swept —
 * a clean nothing that skipped the archive.
 * ---------------------------------------------------------------------------
 */

export type WebVendorId = "brave-web" | "serper-news";

export interface WebVendor {
  id: WebVendorId;
  /** The vendor name every ledger row and raw-archive folder carries. */
  vendor: string;
  endpoint: string;
  /** The `.env.local` variable holding the key. */
  keyName: string;
  /** Files under `research/`. One ledger per vendor, one state file per vendor and endpoint. */
  ledgerFile: string;
  stateFile: string;
  /** Prefix of the raw-archive label, so a folder listing says what each file was. */
  rawLabelPrefix: string;
  /** USD per request as billed. Zero while Serper runs on its card-free credits. */
  unitPriceUsd: number;
  /** Most results one request may return on the plan in use. */
  pageSize: number;
  /** Pages bought per query unless `--pages` says otherwise. See the vendor entries. */
  defaultPages: number;
  /**
   * Query labels this vendor refuses, each with the measurement that showed it.
   * Skipped before any request rather than left to abort the run halfway.
   */
  refusedLabels: Record<string, string>;
}

export const WEB_VENDORS: Record<WebVendorId, WebVendor> = {
  "brave-web": {
    id: "brave-web",
    vendor: "brave-search",
    endpoint: "/res/v1/web/search",
    keyName: "BRAVE_SEARCH_API_KEY",
    ledgerFile: "brave-search-ledger.json",
    stateFile: "web-sweep-state.json",
    rawLabelPrefix: "web-search",
    /** $5 per 1,000 web-search queries, vendor pricing page, 2026-09-22. */
    unitPriceUsd: 0.005,
    pageSize: 20,
    /** Page 2 was measured on the two queries that had one and added no hit. */
    defaultPages: 1,
    refusedLabels: {},
  },
  "serper-news": {
    id: "serper-news",
    vendor: "serper",
    endpoint: "/news",
    keyName: "SERPER_API_KEY",
    ledgerFile: "serper-ledger.json",
    stateFile: "web-sweep-state-serper-news.json",
    rawLabelPrefix: "news",
    /**
     * Free-tier credits, no card on the account: nothing is billed, and the
     * run refuses to start when the balance cannot cover it. Paid top-ups
     * start at $1.00/1k — if a card is ever added, this stops being zero.
     */
    unitPriceUsd: 0,
    /** The free tier refuses `num` above 10 with HTTP 400 (measured, 0 credits). */
    pageSize: 10,
    /** The one real find of the experiment, Queerty, was on page 2 of `/news`. */
    defaultPages: 2,
    refusedLabels: {
      "brand-handle":
        "\"@LayoffAI\" answers HTTP 400 \"Query pattern not allowed for free accounts\" (2026-09-23, 0 credits)",
      "brand-domain":
        "\"layoffhedge.com\" answers the same HTTP 400 on the free tier (2026-09-23, 0 credits); " +
        "the bare brand token, brand-closed, is accepted",
    },
  },
};

export function webVendor(id: string | null): WebVendor | null {
  if (id === null) return WEB_VENDORS["brave-web"];
  return id in WEB_VENDORS ? WEB_VENDORS[id as WebVendorId] : null;
}

// ---------------------------------------------------------------------------
// Serper
// ---------------------------------------------------------------------------

export const SERPER_API = "https://google.serper.dev";

/** One result as `/news` returns it. */
export interface SerperNewsItem {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
  source?: string;
}

/**
 * The JSON body of one `/news` request.
 *
 * `autocorrect: false` for the reason Brave gets `spellcheck=false`: an exact
 * figure or phrase rewritten by the engine is a different question. `num` is
 * the page size the free tier accepts; `page` is 1-based and omitted on the
 * first page, as the vendor's own playground omits it.
 */
export function serperNewsBody(
  q: string,
  page: number,
  tbs: string | null,
): Record<string, string | number | boolean> {
  return {
    q,
    gl: "us",
    hl: "en",
    autocorrect: false,
    num: WEB_VENDORS["serper-news"].pageSize,
    ...(page > 1 ? { page } : {}),
    ...(tbs !== null ? { tbs } : {}),
  };
}

/**
 * Translates a freshness value into Google's `tbs`, **rounding the window up**.
 *
 * `--since-last` produces Brave's range syntax (`YYYY-MM-DDtoYYYY-MM-DD`,
 * `sweep-state.ts`). Google's own custom range, `cdr:1,cd_min:…,cd_max:…`,
 * **is accepted, echoed back, and ignored by `/news`**: measured 2026-09-23, a
 * one-day `cdr` window returned ten articles four months old, while `qdr:w` on
 * the same query returned the one article from that day. So a range becomes
 * the smallest fixed bucket that contains it — past week, month or year — and
 * a gap longer than a year sweeps unrestricted.
 *
 * Rounding up only costs a few old results, which the diff against the
 * dataset and the dedupe absorb; rounding down would skip pages silently. The
 * margins below keep a bucket from ending a day short.
 *
 * Anything that is not a range passes through, so `--freshness qdr:w` works in
 * the vendor's own syntax, as `--freshness pw` does for Brave.
 */
export function serperTbs(freshness: string | null): string | null {
  if (freshness === null) return null;
  const range = freshness.match(/^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/);
  if (range === null) return freshness;
  const days = (Date.parse(range[2]!) - Date.parse(range[1]!)) / 86_400_000;
  if (days <= 5) return "qdr:w";
  if (days <= 25) return "qdr:m";
  if (days <= 350) return "qdr:y";
  return null;
}

/**
 * The items of a `/news` answer, and whether a further page may exist.
 *
 * Serper has no equivalent of Brave's `more_results_available`, so the only
 * signal is a full page. It is a guess and it can be wrong in the costly
 * direction: measured once, a full page 1 was followed by an empty page 2 that
 * still cost a credit.
 */
export function readSerperNews(body: unknown): { items: SerperNewsItem[]; morePossible: boolean } {
  const news = (body as { news?: unknown } | null)?.news;
  const items = Array.isArray(news) ? (news as SerperNewsItem[]) : [];
  return { items, morePossible: items.length >= WEB_VENDORS["serper-news"].pageSize };
}

/** The credits a response says it cost, or null when the body does not say. */
export function serperCredits(body: unknown): number | null {
  const credits = (body as { credits?: unknown } | null)?.credits;
  return typeof credits === "number" ? credits : null;
}
