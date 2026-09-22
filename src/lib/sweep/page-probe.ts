/**
 * Fetch a page somebody else published and report whether it names this
 * project — the half of `check:media-mentions` that has nothing to do with
 * where the URL came from.
 *
 * ---------------------------------------------------------------------------
 * **Why it left the script.**
 *
 * The tool could only probe records *already in* `data/media.json`. B14 needed
 * to probe five press cards and 23 outlet about-pages that were in no file
 * yet, and the answer was two throwaway scripts inside the batch, each
 * reimplementing this same direct→proxy fetch (`docs/WORKPLAN.md` B11). The
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

/** A thing to fetch. `id` names the saved text file; `publication` is a label. */
export interface ProbeTarget {
  id: string;
  publication: string;
  url: string;
}

export interface ProbeResult extends ProbeTarget {
  /** How the text below was obtained. */
  via: "direct" | "proxy" | "none";
  httpStatus: number;
  /** Every form found, weak ones counted separately (`mention-patterns.ts`). */
  mentions: MentionReport;
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

const REQUEST_TIMEOUT_MS = 45_000;
const PROXY_ATTEMPTS = 3;
const PROXY_BACKOFF_MS = 6_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

export async function fetchPageText(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; text: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    return { status: response.status, text: toText(body) };
  } catch (error) {
    // Never surface a stack: the interesting part is which URL failed and how.
    return { status: 0, text: "", error: (error as Error).name || "fetch failed" };
  }
}

async function fetchThroughProxy(url: string): Promise<{ status: number; text: string }> {
  for (let attempt = 0; attempt < PROXY_ATTEMPTS; attempt++) {
    const result = await fetchPageText(`${PROXY}${url}`, PROXY_HEADERS);
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
 */
export async function probePage(target: ProbeTarget, options: ProbeOptions): Promise<ProbeResult> {
  const direct = await fetchPageText(target.url, DIRECT_HEADERS);
  let via: ProbeResult["via"] = direct.status === 200 ? "direct" : "none";
  let httpStatus = direct.status;
  let text = direct.text;
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

  const textFile =
    text.length > 0 && options.saveText ? options.saveText(target, text) : undefined;

  return {
    ...target,
    via,
    httpStatus,
    mentions,
    textLength: text.length,
    ...(textFile !== undefined ? { textFile } : {}),
    ...(direct.error !== undefined && via === "none" ? { error: direct.error } : {}),
  };
}

/** A brand hit beats any number of weak ones; otherwise more matches wins. */
export function betterFind(candidate: MentionReport, current: MentionReport): boolean {
  if (candidate.brand !== current.brand) return candidate.brand;
  return candidate.total > current.total;
}
