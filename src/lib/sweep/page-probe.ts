/**
 * Fetch a page somebody else published and report whether it names this
 * project — the half of `check:media-mentions` that has nothing to do with
 * where the URL came from.
 *
 * ---------------------------------------------------------------------------
 * **Why it left the script.**
 *
 * The tool could only probe records *already in* `data/media.json`. An
 * earlier session needed to probe five press cards and 23 outlet about-pages
 * that were in no file yet, and the answer was two throwaway scripts, each
 * reimplementing this same direct→proxy fetch. The
 * web sweep starts from URLs that are in no file by definition, so the third
 * reimplementation was already scheduled. This is the core both input modes
 * share; selecting the targets is the script's job and only that.
 *
 * **The two requests need different headers, and getting it wrong silently
 * disables the fallback.** A publisher refuses a default agent, so the direct
 * request carries a browser user-agent; `r.jina.ai` refuses *that* user-agent
 * with a 403 of its own. Sending browser headers to both made every blocked
 * record report as "not retrievable" when the proxy would have returned it.
 * Verified 2026-09-19 on the Financial Express URL: default agent 200, browser
 * agent 403. That is why these are two constants and not one.
 * ---------------------------------------------------------------------------
 */
import { detectMentions, toText, type MentionReport } from "./mention-patterns";
import {
  extractArticleMetadata,
  metadataFromMsnDetail,
  msnContentUrl,
  type ArticleMetadata,
} from "./page-metadata";

/** A thing to fetch. `id` names the saved text file; `publication` is a label. */
export interface ProbeTarget {
  id: string;
  publication: string;
  url: string;
}

export interface ProbeResult extends ProbeTarget {
  /**
   * How the text below was obtained: the page itself, the reader proxy, MSN's
   * content endpoint (tried first for an MSN article, whose page is a shell),
   * or a Wayback Machine snapshot (tried last, when nothing else answered).
   */
  via: "direct" | "proxy" | "msn" | "wayback" | "none";
  httpStatus: number;
  /** Every form found, weak ones counted separately (`mention-patterns.ts`). */
  mentions: MentionReport;
  /** What the page states about itself (`page-metadata.ts`); `null` when it states nothing. */
  metadata: ArticleMetadata | null;
  /** A Wayback copy's timestamp — the capture's date, not the article's. */
  waybackSnapshot?: string;
  /**
   * The copy's address. Set with `via: "wayback"` when it was read, and also on
   * an unreadable page when a copy exists but the archive refused this server:
   * a person can open it in a browser.
   */
  waybackUrl?: string;
  textLength: number;
  /** Where this run left the extracted text, relative to the repo root. */
  textFile?: string;
  error?: string;
}

export const PROXY = "https://r.jina.ai/";

export const DIRECT_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,text/plain,*/*",
};

export const PROXY_HEADERS: Record<string, string> = { accept: "text/plain" };

/** The proxy returns the page's HTML, scripts included, when asked for it this way. */
const PROXY_HTML_HEADERS: Record<string, string> = { "x-return-format": "html" };

const REQUEST_TIMEOUT_MS = 45_000;
const PROXY_ATTEMPTS = 3;
const PROXY_BACKOFF_MS = 6_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** `raw` is the body as served, kept so the page's own metadata can be read before `toText` drops it. */
export async function fetchPageText(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; text: string; raw: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    return { status: response.status, text: toText(body), raw: body };
  } catch (error) {
    // Never surface a stack: the interesting part is which URL failed and how.
    return { status: 0, text: "", raw: "", error: (error as Error).name || "fetch failed" };
  }
}

/** An MSN article through MSN's content endpoint; `null` for any other URL or a failed read. */
async function fetchFromMsn(url: string): Promise<{ text: string; metadata: ArticleMetadata } | null> {
  const endpoint = msnContentUrl(url);
  if (endpoint === null) return null;
  const result = await fetchPageText(endpoint, { accept: "application/json" });
  if (result.status !== 200) return null;
  try {
    const metadata = metadataFromMsnDetail(JSON.parse(result.raw));
    if (metadata?.articleBody == null) return null;
    return { text: metadata.articleBody, metadata };
  } catch {
    return null;
  }
}

const WAYBACK_ATTEMPTS = 2;

/** A Wayback Machine copy: read, or only known to exist. */
type WaybackCopy =
  | { read: true; text: string; raw: string; snapshot: string; url: string }
  | { read: false; snapshot: string; url: string };

/**
 * The closest Wayback Machine snapshot, read raw (`id_`, without the archive's
 * toolbar). Tried only when the page and the proxy both failed.
 *
 * The lookup (`archive.org/wayback/available`) and the snapshot
 * (`web.archive.org`) are throttled separately. On 2026-09-29 the lookup
 * answered this project's server every time and the snapshot host answered
 * HTTP 429 every time, after pauses of up to 45 seconds. So a copy that
 * exists but cannot be read is still reported, with its URL: a person's browser
 * is throttled on its own account and can open it.
 */
async function fetchFromWayback(url: string): Promise<WaybackCopy | null> {
  const lookup = await fetchPageText(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { accept: "application/json" },
  );
  if (lookup.status !== 200) return null;
  let closest: { url?: string; timestamp?: string; available?: boolean } | undefined;
  try {
    closest = (JSON.parse(lookup.raw) as { archived_snapshots?: { closest?: typeof closest } })
      .archived_snapshots?.closest;
  } catch {
    return null;
  }
  if (closest?.available !== true || closest.url === undefined || closest.timestamp === undefined) {
    return null;
  }
  const copyUrl = closest.url.replace(/^http:/, "https:");
  const rawUrl = copyUrl.replace(/\/web\/(\d+)\//, "/web/$1id_/");
  for (let attempt = 0; attempt < WAYBACK_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(PROXY_BACKOFF_MS);
    const snapshot = await fetchPageText(rawUrl, DIRECT_HEADERS);
    if (snapshot.status === 200) {
      return { read: true, text: snapshot.text, raw: snapshot.raw, snapshot: closest.timestamp, url: copyUrl };
    }
    if (snapshot.status !== 429) break;
  }
  return { read: false, snapshot: closest.timestamp, url: copyUrl };
}

/**
 * The visible text, plus the article body the metadata carries when the
 * visible text lacks it — NewsBreak serves a teaser and keeps the full piece
 * in its JSON-LD.
 */
function withArticleBody(text: string, metadata: ArticleMetadata | null): string {
  const body = metadata?.articleBody;
  if (body == null || body.length === 0 || text.includes(body.slice(0, 200))) return text;
  return `${text}\n\n[article body from the page's metadata]\n${body}`;
}

/**
 * The proxy answers 200 even when the site refused it, and says so inside the
 * text ("Warning: Target URL returned error 403: Forbidden"). Counting that as
 * a read made a refused page look fetched and kept the Wayback route from ever
 * being tried; the site's own status is what the proxy reports instead.
 */
const PROXY_TARGET_ERROR = /Warning: Target URL returned error (\d{3})/;

async function fetchThroughProxy(url: string): Promise<{ status: number; text: string }> {
  for (let attempt = 0; attempt < PROXY_ATTEMPTS; attempt++) {
    const result = await fetchPageText(`${PROXY}${url}`, PROXY_HEADERS);
    const targetError = PROXY_TARGET_ERROR.exec(result.text);
    if (result.status === 200 && targetError !== null) return { status: Number(targetError[1]), text: "" };
    if (result.status === 200) return { status: 200, text: result.text };
    await sleep(PROXY_BACKOFF_MS);
  }
  return { status: 0, text: "" };
}

export interface ProbeOptions {
  useProxy: boolean;
  /** Called with the extracted text; returns the path it was saved to. */
  saveText?: (target: ProbeTarget, text: string) => string;
}

/**
 * One target, fetched and read.
 *
 * The proxy is tried when the page was refused **or** came back without the
 * name: the second case catches client-rendered articles whose text is not in
 * the HTML the server returns. The proxy's answer only wins when it fetched
 * something the direct request could not, or found more of the name than the
 * direct request did — `brand` beats `weak` in that comparison, because a page
 * where the proxy finds "LayoffHedge" and the direct fetch found "official
 * layoff" is a page whose proxy text is the one worth keeping.
 *
 * Two routes sit around those: an MSN article is read first through MSN's
 * content endpoint, because its page never holds the text; and when the page
 * and the proxy both fail, the closest Wayback Machine snapshot is read.
 * Metadata comes from whichever answer was HTML or MSN JSON — the proxy
 * returns plain text, which carries none.
 */
export async function probePage(target: ProbeTarget, options: ProbeOptions): Promise<ProbeResult> {
  const msn = await fetchFromMsn(target.url);
  if (msn !== null) return finish(target, options, "msn", 200, msn.text, msn.metadata);

  const direct = await fetchPageText(target.url, DIRECT_HEADERS);
  let via: ProbeResult["via"] = direct.status === 200 ? "direct" : "none";
  let httpStatus = direct.status;
  let metadata = direct.status === 200 ? extractArticleMetadata(direct.raw) : null;
  let text = withArticleBody(direct.text, metadata);
  let mentions = detectMentions(text);

  if (options.useProxy && (direct.status !== 200 || mentions.total === 0)) {
    const proxied = await fetchThroughProxy(target.url);
    const proxiedMentions = detectMentions(proxied.text);
    if (proxied.status === 200 && (direct.status !== 200 || betterFind(proxiedMentions, mentions))) {
      via = "proxy";
      httpStatus = proxied.status;
      text = proxied.text;
      mentions = proxiedMentions;
    }
  }

  // The proxy's text carries no metadata. When it is the only route that read
  // the page, one more request asks it for the HTML instead — the Tennessee
  // Star's site answers a server with a Cloudflare challenge, and its only
  // timestamp is in the JSON-LD the proxy can return.
  if (via === "proxy" && metadata === null) {
    const proxiedHtml = await fetchPageText(`${PROXY}${target.url}`, PROXY_HTML_HEADERS);
    if (proxiedHtml.status === 200) metadata = extractArticleMetadata(proxiedHtml.raw);
  }

  // A third party, like the proxy, so `--no-proxy` switches it off too.
  if (via === "none" && options.useProxy) {
    const archived = await fetchFromWayback(target.url);
    if (archived?.read === true) {
      const archivedMetadata = extractArticleMetadata(archived.raw);
      const result = finish(
        target,
        options,
        "wayback",
        200,
        withArticleBody(archived.text, archivedMetadata),
        archivedMetadata,
      );
      return { ...result, waybackSnapshot: archived.snapshot, waybackUrl: archived.url };
    }
    if (archived !== null) {
      const result = finish(target, options, via, httpStatus, text, metadata);
      return {
        ...result,
        waybackSnapshot: archived.snapshot,
        waybackUrl: archived.url,
        ...(direct.error !== undefined ? { error: direct.error } : {}),
      };
    }
  }

  const result = finish(target, options, via, httpStatus, text, metadata);
  return direct.error !== undefined && via === "none" ? { ...result, error: direct.error } : result;
}

function finish(
  target: ProbeTarget,
  options: ProbeOptions,
  via: ProbeResult["via"],
  httpStatus: number,
  text: string,
  metadata: ArticleMetadata | null,
): ProbeResult {
  const textFile =
    text.length > 0 && options.saveText ? options.saveText(target, text) : undefined;
  return {
    ...target,
    via,
    httpStatus,
    mentions: detectMentions(text),
    metadata,
    textLength: text.length,
    ...(textFile !== undefined ? { textFile } : {}),
  };
}

/** A brand hit beats any number of weak ones; otherwise more matches wins. */
export function betterFind(candidate: MentionReport, current: MentionReport): boolean {
  if (candidate.brand !== current.brand) return candidate.brand;
  return candidate.total > current.total;
}
