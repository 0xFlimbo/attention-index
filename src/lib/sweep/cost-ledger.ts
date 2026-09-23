/**
 * What every billed request cost, appended as it happens.
 *
 * ---------------------------------------------------------------------------
 * **Why a ledger and not a count of files.**
 *
 * `research/x-api-2026-09-20/cost-ledger.json` is described in
 * `research/README.md` as the one file there that can **never** be replaced:
 * it is a record of spend, and a spend record cannot be reconstructed from the
 * responses it paid for. The X work kept one by hand. The web sweep would
 * otherwise have its spend inferred by counting files in `raw/`, which stops
 * being true the first time somebody moves, prunes or re-runs anything.
 *
 * **It also answers the question the next run actually asks**, which is not
 * "what did we spend" but "what will this cost and what does it return":
 * queries, results per query, candidates per query, and the vendor's own
 * rate-limit headers at that moment, per day. A per-query yield measured over
 * a few runs is what turns the next sweep's budget from a guess into a figure.
 *
 * **The modelled cost is labelled as modelled, everywhere.** This vendor
 * publishes no balance endpoint, so nothing here is a meter reading in the
 * sense `docs/PROVIDERS.md` means it. The honest shape is: record what was
 * asked, record what the response said about our quota, multiply by the
 * published unit price, and never call the product a measurement.
 * ---------------------------------------------------------------------------
 */

export interface LedgerEntry {
  at: string;
  /** Which vendor and endpoint — a ledger outlives the script that wrote it. */
  vendor: string;
  endpoint: string;
  /** The query set version and label, so yield is comparable across runs. */
  querySetVersion: string;
  queryLabel: string;
  /**
   * The `q` actually sent.
   *
   * The label is not enough and the first yield table proved it:
   * `investigation-trine` had run three times under three different wordings,
   * and aggregating them read as one query with a history. A label is a name;
   * this is what was asked.
   */
  q: string;
  /**
   * Which page of results this request asked for, zero-based. Pagination is a
   * separate billed request per page, so a ledger that recorded only the label
   * would show one query costing $0.015 with no way to see why.
   */
  offset: number;
  httpStatus: number;
  resultCount: number;
  /** Unit price at the time of the call, in USD. Prices move; readings do not. */
  unitPriceUsd: number;
  /** `unitPriceUsd` for one request — modelled, never metered. See above. */
  modelledCostUsd: number;
  /** The vendor's own quota headers as they read at that moment. */
  rateLimit: Record<string, string>;
  /**
   * What this request's results were, by verdict — `known`, `self`,
   * `no_reporting`, `candidate` — counted **before** cross-query dedupe, so a
   * page two queries both found counts for both.
   *
   * This is what makes per-query yield measure itself. The first sweep's yield
   * table had to be reconstructed by joining a run report against a fetch
   * report by hand, which is the kind of number nobody recomputes and everybody
   * quotes. Deliberately `Record<string, number>` rather than the sweep's own
   * verdict union: a ledger outlives the script that wrote it.
   */
  verdicts: Record<string, number>;
  /**
   * `"live"` when the entry was written by the request itself, `"reconstructed"`
   * when it was rebuilt from an archived response after the fact.
   *
   * The distinction is not pedantry: the first five requests this project made
   * to this vendor happened before the ledger existed and were rebuilt from
   * `raw/`. A reconstruction is as accurate as the archive it came from and no
   * more, and a spend record that mixes the two without saying so is the kind
   * of quiet inaccuracy this file exists to prevent.
   */
  source: "live" | "reconstructed";
}

/**
 * What the free verification stage found, per query.
 *
 * **Kept in its own array rather than amended onto the entry it belongs to.**
 * A spend record is trustworthy because nothing rewrites it after the fact,
 * and the fetch stage happens minutes later — so it appends its own rows
 * instead of reaching back into the billed ones. `yieldByQuery` joins the two
 * by label.
 *
 * This is the number that matters and the one the first sweep could not see:
 * candidates are a poor proxy for value. The company-story cluster returned 45
 * candidates and **zero** real hits, while `jobs-foreign-born-4-in-5` returned
 * a single result that was a real hit.
 */
export interface FetchOutcome {
  at: string;
  queryLabel: string;
  querySetVersion: string;
  probed: number;
  /** Pages carrying a brand form of the name — the real hits. */
  brandHits: number;
  /** Pages where only a weak form matched: read them, never count them. */
  weakOnly: number;
  absent: number;
  unreachable: number;
  /**
   * `"live"` when the sweep's own `--fetch` wrote it, `"reconstructed"` when it
   * was rebuilt afterwards from a run report and a fetch report. The first two
   * passes were run as separate commands before this existed, and a yield table
   * that presented a reconstruction as a live reading would be quietly wrong
   * about how the number was obtained.
   */
  source: "live" | "reconstructed";
}

export interface Ledger {
  vendor: string;
  note: string;
  entries: LedgerEntry[];
  /** Free verification passes. Absent on ledgers written before 2026-09-22. */
  fetches?: FetchOutcome[];
}

export const LEDGER_NOTE =
  "A record of spend. Costs are MODELLED (unit price x requests): this vendor publishes no " +
  "balance endpoint, so the only true meter is the vendor dashboard. Never regenerated — " +
  "the responses this paid for cannot reconstruct it.";

export function emptyLedger(vendor: string): Ledger {
  return { vendor, note: LEDGER_NOTE, entries: [], fetches: [] };
}

/** Only the quota headers, which is all a ledger needs from a response. */
export function rateLimitHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase().startsWith("x-ratelimit")),
  );
}

export function ledgerEntry(input: {
  at: string;
  vendor: string;
  endpoint: string;
  querySetVersion: string;
  queryLabel: string;
  q: string;
  /**
   * Which page of results this request asked for, zero-based. Pagination is a
   * separate billed request per page, so a ledger that recorded only the label
   * would show one query costing $0.015 with no way to see why.
   */
  offset?: number;
  httpStatus: number;
  resultCount: number;
  unitPriceUsd: number;
  headers: Record<string, string>;
  verdicts?: Record<string, number>;
  source?: "live" | "reconstructed";
}): LedgerEntry {
  return {
    at: input.at,
    vendor: input.vendor,
    endpoint: input.endpoint,
    querySetVersion: input.querySetVersion,
    queryLabel: input.queryLabel,
    q: input.q,
    offset: input.offset ?? 0,
    httpStatus: input.httpStatus,
    resultCount: input.resultCount,
    unitPriceUsd: input.unitPriceUsd,
    modelledCostUsd: input.unitPriceUsd,
    rateLimit: rateLimitHeaders(input.headers),
    verdicts: input.verdicts ?? {},
    source: input.source ?? "live",
  };
}

export interface LedgerSummary {
  requests: number;
  modelledCostUsd: number;
  results: number;
  /** Results per request — the number the next run's budget is built from. */
  resultsPerRequest: number;
  firstAt: string | null;
  lastAt: string | null;
}

/**
 * A failed request is counted as a request: the vendor may well have billed it,
 * and a ledger that quietly drops the calls that went wrong understates spend
 * in exactly the case where understating it is most expensive.
 */
export function summarise(entries: LedgerEntry[]): LedgerSummary {
  const requests = entries.length;
  const results = entries.reduce((total, entry) => total + entry.resultCount, 0);
  return {
    requests,
    modelledCostUsd: Number(
      entries.reduce((total, entry) => total + entry.modelledCostUsd, 0).toFixed(4),
    ),
    results,
    resultsPerRequest: requests === 0 ? 0 : Number((results / requests).toFixed(2)),
    firstAt: entries[0]?.at ?? null,
    lastAt: entries.at(-1)?.at ?? null,
  };
}

export interface QueryYield {
  queryLabel: string;
  requests: number;
  results: number;
  known: number;
  candidates: number;
  modelledCostUsd: number;
  /** Results per request, and the number a next-run estimate is built on. */
  resultsPerRequest: number;
  /**
   * Pages that actually named this project, from the free fetch stage.
   * `null` when this label has never been fetched — which is not zero, and a
   * table that showed it as zero would retire a query that was never checked.
   */
  brandHits: number | null;
  /** The query set versions this label has run under. */
  querySetVersions: string[];
  /**
   * `true` when this label has been sent as more than one `q`.
   *
   * Its totals are then a sum over different questions, which is not a yield.
   * Surfaced rather than silently averaged.
   */
  reworded: boolean;
}

/**
 * Per-query yield across every run in the ledger, worst-performing last.
 *
 * `known` is not waste: a query that keeps returning records already in the
 * file is the control that proves the index still holds this project's
 * coverage, which is how a zero-candidate run is told apart from an index that
 * has never heard of us. What it measures is whether a query is doing *a* job,
 * not whether it found something new.
 */
export function yieldByQuery(entries: LedgerEntry[], fetches: FetchOutcome[] = []): QueryYield[] {
  const byLabel = new Map<string, QueryYield>();
  /** Distinct `q` strings seen per label — see `reworded`. */
  const wordings = new Map<string, Set<string>>();

  for (const entry of entries) {
    const current = byLabel.get(entry.queryLabel) ?? {
      queryLabel: entry.queryLabel,
      requests: 0,
      results: 0,
      known: 0,
      candidates: 0,
      modelledCostUsd: 0,
      resultsPerRequest: 0,
      brandHits: null,
      querySetVersions: [],
      reworded: false,
    };
    /*
     * Read defensively: 21 entries written before verdicts existed are on disk
     * already, and a type cannot make a field appear in a file. A ledger is the
     * one structure here that is guaranteed to outlive the shape its writer had.
     */
    const verdicts = entry.verdicts ?? {};
    current.requests += 1;
    current.results += entry.resultCount;
    current.known += verdicts["known"] ?? 0;
    current.candidates += verdicts["candidate"] ?? 0;
    current.modelledCostUsd = Number((current.modelledCostUsd + entry.modelledCostUsd).toFixed(4));
    if (!current.querySetVersions.includes(entry.querySetVersion)) {
      current.querySetVersions.push(entry.querySetVersion);
    }
    const seen = wordings.get(entry.queryLabel) ?? new Set<string>();
    if (entry.q !== undefined) seen.add(entry.q);
    wordings.set(entry.queryLabel, seen);
    current.reworded = seen.size > 1;
    byLabel.set(entry.queryLabel, current);
  }

  for (const fetched of fetches) {
    const row = byLabel.get(fetched.queryLabel);
    if (row === undefined) continue;
    row.brandHits = (row.brandHits ?? 0) + fetched.brandHits;
  }

  return [...byLabel.values()]
    .map((row) => ({
      ...row,
      resultsPerRequest: Number((row.results / row.requests).toFixed(2)),
    }))
    /*
     * Real hits first, then candidates. A query is worth its $0.005 for what a
     * human could act on, and the first sweep showed those two numbers pulling
     * in opposite directions: 45 candidates and no hits from one cluster, one
     * result and one hit from a query costing the same.
     */
    .sort(
      (a, b) =>
        (b.brandHits ?? -1) - (a.brandHits ?? -1) ||
        b.candidates + b.known - (a.candidates + a.known),
    );
}

export function fetchOutcome(input: {
  at: string;
  queryLabel: string;
  querySetVersion: string;
  results: { httpStatus: number; mentions: { brand: boolean; total: number } }[];
  source?: "live" | "reconstructed";
}): FetchOutcome {
  const fetched = input.results.filter((result) => result.httpStatus === 200);
  return {
    at: input.at,
    queryLabel: input.queryLabel,
    querySetVersion: input.querySetVersion,
    probed: input.results.length,
    brandHits: fetched.filter((result) => result.mentions.brand).length,
    weakOnly: fetched.filter((result) => !result.mentions.brand && result.mentions.total > 0).length,
    absent: fetched.filter((result) => result.mentions.total === 0).length,
    unreachable: input.results.length - fetched.length,
    source: input.source ?? "live",
  };
}
