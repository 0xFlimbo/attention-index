/**
 * What a web-search result is, before anybody spends time on it
 * (`docs/WORKPLAN.md` B11).
 *
 * A sweep's output is a queue of pages for a human to read, and the expensive
 * resource is the human. Three of the first six probe queries, 2026-09-22,
 * returned the same shape — a `twitterscore.io` account card, an Instagram tag
 * page, a Threads post — which is what made B14's open question 14 a
 * load-bearing rule rather than a precaution: **a result that carries no
 * reporting of its own is archived on sight**, never fitted to a provenance
 * value.
 *
 * Everything here is pure and none of it decides anything. It sorts a result
 * into a bucket and says why; promotion is a human edit, and so is the
 * judgement that a page in the `no_reporting` bucket really is one.
 */

/** The project's own surfaces. A sweep that finds us is finding nothing. */
const SELF_HOSTS = ["layoffhedge.com", "x.com/layoffai", "twitter.com/layoffai"];

/**
 * Hosts that distribute somebody else's work rather than publishing their own.
 *
 * Kept short and evidenced on purpose. Each entry is either a surface the
 * discovery probe actually returned or one the dataset has already archived
 * under open question 14. A host is not a verdict — `NewsBreak` syndicates and
 * is deliberately absent, because a syndication of a named outlet's piece is a
 * record under B13's contract, while a bare link card is not.
 */
const DISTRIBUTION_HOSTS = [
  "twitterscore.io",
  // Added 2026-09-22 from the first full sweep: each of these returned a brand
  // hit on fetch and none of them is a publication. Without them the reader is
  // handed four pages that name the project and report nothing — the most
  // expensive kind of false positive, because the string really is there.
  "linktr.ee",
  "urlscan.io",
  "threadreaderapp.com",
  "coingecko.com",
  "books.google.com",
  "instagram.com",
  "threads.net",
  "threads.com",
  "facebook.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
  "x.com",
  "twitter.com",
  "t.co",
  "binance.com",
  "youtube.com",
  "youtu.be",
];

export type ResultVerdict = "self" | "known" | "no_reporting" | "candidate";

export interface WebSearchResult {
  title: string;
  url: string;
  description?: string;
  /** Whatever the engine says about age or publication date, verbatim. */
  age?: string;
  /** The query that produced it, so a candidate carries its provenance. */
  query: string;
  queryLabel: string;
}

export interface ClassifiedResult extends WebSearchResult {
  verdict: ResultVerdict;
  /** Why, in the reader's words — it goes straight into the report. */
  reason: string;
  host: string;
  normalizedUrl: string;
}

/** Tracking parameters carry no meaning and split one page into many. */
const TRACKING_PARAMS = /^(utm_\w*|fbclid|gclid|mc_\w*|ref|ref_src|ref_url|igshid|si)$/i;

/**
 * One spelling per page, so a result can be compared with `data/media.json`.
 *
 * Deliberately conservative: the scheme, the `www.`, the trailing slash, the
 * fragment and the tracking parameters go; a real query parameter stays,
 * because `?p=1234` is a permalink on a great many small publishers and
 * dropping it would merge unrelated articles into one.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.host.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    const kept = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    const query =
      kept.length > 0 ? `?${kept.map(([k, v]) => `${k}=${v}`).join("&")}` : "";
    return `${host}${path}${query}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unparseable-url";
  }
}

/** Every URL the dataset already holds, in one spelling. */
export function buildKnownUrlIndex(records: { url: string }[]): Set<string> {
  return new Set(records.map((record) => normalizeUrl(record.url)));
}

export function classifyResult(
  result: WebSearchResult,
  knownUrls: Set<string>,
): ClassifiedResult {
  const host = hostOfUrl(result.url);
  const normalizedUrl = normalizeUrl(result.url);
  const base = { ...result, host, normalizedUrl };

  if (SELF_HOSTS.some((self) => normalizedUrl === self || normalizedUrl.startsWith(`${self}/`))) {
    return { ...base, verdict: "self", reason: "the project's own surface" };
  }
  if (knownUrls.has(normalizedUrl)) {
    return { ...base, verdict: "known", reason: "already a record in data/media.json" };
  }
  if (DISTRIBUTION_HOSTS.includes(host)) {
    return {
      ...base,
      verdict: "no_reporting",
      reason: "distribution surface — archive on sight unless the page carries its own reporting",
    };
  }
  return { ...base, verdict: "candidate", reason: "not in any file — fetch it and read it" };
}

/** First occurrence wins, so a result keeps the query that found it first. */
export function dedupeResults(results: ClassifiedResult[]): ClassifiedResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.normalizedUrl)) return false;
    seen.add(result.normalizedUrl);
    return true;
  });
}

export function countByVerdict(results: ClassifiedResult[]): Record<ResultVerdict, number> {
  const counts: Record<ResultVerdict, number> = {
    self: 0,
    known: 0,
    no_reporting: 0,
    candidate: 0,
  };
  for (const result of results) counts[result.verdict] += 1;
  return counts;
}
