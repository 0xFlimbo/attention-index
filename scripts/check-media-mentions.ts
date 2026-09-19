/**
 * pnpm check:media-mentions [-- --status needs_review] [-- --id <media-id>]
 *                           [-- --limit N] [-- --delay MS] [-- --no-proxy]
 *
 * Occasional maintenance tool (docs/ENGINEERING.md §17). Never called during
 * `next build`, rendering, or CI.
 *
 * **Strictly read-only.** It opens `data/media.json`, fetches each record's
 * `url`, and reports whether the article's own text contains `layoffhedge` or
 * `@LayoffAI`. It never writes to `data/` — promotion stays a human edit.
 *
 * **A hit is not a verification, and the report says so on every line.** It
 * means the string is present on the page, not that the article supports the
 * record as written: the string could sit in a sidebar, a related-links rail
 * or an unrelated quote. `docs/WORKPLAN.md` B14's acceptance bar is unchanged
 * — the article itself must be read before a record is promoted. What this
 * buys is that the reading starts from a fetched page with a located mention
 * instead of from a bare URL, which measurement showed covers ~83% of the
 * queue (`docs/HISTORY.md`, 2026-09-19).
 *
 * **Why the proxy fallback exists.** Sixteen of the 82 press-page URLs answer
 * `403` to a plain request — BeInCrypto, Financial Express, Sportskeeda,
 * ROI-NJ and others behind bot protection. All of them are retrievable
 * through `r.jina.ai`, which renders the page and returns plain text. The
 * pacing matters: a fast burst gets throttled and looks exactly like a hard
 * block, which is what made the first measurement pass read as a wall.
 *
 * Raw fetched text goes to the gitignored `.cache/`, never into canonical
 * JSON, so a second run over the same records is cheap to inspect by hand.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { mediaFileSchema, type MediaReference } from "../src/schemas/media.schema";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const CACHE_DIR = resolve(ROOT, ".cache");
const REPORT_FILE = resolve(CACHE_DIR, "media-mentions.json");

const PROXY = "https://r.jina.ai/";
/**
 * A publisher answers a default agent with `403`, so the direct request looks
 * like a browser. The **proxy must not** get the same headers: `r.jina.ai`
 * refuses a browser user-agent with its own `403`, which silently disabled
 * the whole fallback the first time this shipped — the record then reported
 * as "not retrievable" when the proxy would in fact have returned it.
 * Verified 2026-09-19 on the Financial Express URL: default agent `200`,
 * browser agent `403`.
 */
const DIRECT_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,text/plain,*/*",
};

const PROXY_HEADERS: Record<string, string> = { accept: "text/plain" };
const REQUEST_TIMEOUT_MS = 45_000;
const PROXY_ATTEMPTS = 3;
const PROXY_BACKOFF_MS = 6_000;

/** The project's own names, the only thing this script looks for. */
const MENTION_PATTERNS = [/layoffhedge/gi, /@?layoffai/gi];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flagValue(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const statusFilter = flagValue("status") ?? "needs_review";
const idFilter = flagValue("id");
const limit = Number(flagValue("limit") ?? Number.POSITIVE_INFINITY);
// Default pacing is deliberately unhurried: the proxy throttles a burst, and a
// throttled response is indistinguishable from a blocked one in the report.
const delayMs = Number(flagValue("delay") ?? 3_000);
const useProxy = !args.includes("--no-proxy");

// ---------------------------------------------------------------------------

interface ProbeResult {
  id: string;
  publication: string;
  url: string;
  /** "direct" | "proxy" | "none" — how the text below was obtained. */
  via: "direct" | "proxy" | "none";
  httpStatus: number;
  mentions: number;
  textLength: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** Crude tag strip — enough to tell prose from markup; never parsed as HTML. */
function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMentions(text: string): number {
  return MENTION_PATTERNS.reduce((total, pattern) => {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    return total + (matches?.length ?? 0);
  }, 0);
}

async function fetchText(
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
    const result = await fetchText(`${PROXY}${url}`, PROXY_HEADERS);
    if (result.status === 200) return { status: 200, text: result.text };
    await sleep(PROXY_BACKOFF_MS);
  }
  return { status: 0, text: "" };
}

async function probe(record: MediaReference): Promise<ProbeResult> {
  const base = {
    id: record.id,
    publication: record.publication,
    url: record.url,
  };

  const direct = await fetchText(record.url, DIRECT_HEADERS);
  let via: ProbeResult["via"] = direct.status === 200 ? "direct" : "none";
  let httpStatus = direct.status;
  let text = direct.text;
  let mentions = countMentions(text);

  // Fall back when the page was refused *or* came back without the name — the
  // second case catches client-rendered articles whose text is not in the
  // HTML the server returns.
  if (useProxy && (direct.status !== 200 || mentions === 0)) {
    const proxied = await fetchThroughProxy(record.url);
    const proxiedMentions = countMentions(proxied.text);
    if (proxied.status === 200 && (direct.status !== 200 || proxiedMentions > mentions)) {
      via = "proxy";
      httpStatus = proxied.status;
      text = proxied.text;
      mentions = proxiedMentions;
    }
  }

  return {
    ...base,
    via,
    httpStatus,
    mentions,
    textLength: text.length,
    ...(direct.error !== undefined && via === "none" ? { error: direct.error } : {}),
  };
}

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(resolve(DATA_DIR, "media.json"), "utf-8")) as unknown;
  const parsed = mediaFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("data/media.json failed schema validation — run `pnpm validate:data` first. Aborting.");
    process.exit(1);
  }

  const selected = parsed.data
    .filter((record) => (idFilter !== null ? record.id === idFilter : record.status === statusFilter))
    .slice(0, limit);

  if (selected.length === 0) {
    console.log(`No records matched (status "${statusFilter}"${idFilter ? `, id "${idFilter}"` : ""}).`);
    return;
  }

  console.log(
    `Probing ${selected.length} record(s) · proxy fallback ${useProxy ? "on" : "off"} · ` +
      `${delayMs}ms between records\n`,
  );

  const results: ProbeResult[] = [];
  for (const [index, record] of selected.entries()) {
    const result = await probe(record);
    results.push(result);
    console.log(
      `${String(index + 1).padStart(3)}/${selected.length}  ` +
        `${String(result.httpStatus).padStart(3)}  ` +
        `${String(result.mentions).padStart(3)} mention(s)  ` +
        `${result.via.padEnd(6)}  ${result.publication}`,
    );
    if (index < selected.length - 1) await sleep(delayMs);
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(REPORT_FILE, `${JSON.stringify(results, null, 2)}\n`);

  const fetched = results.filter((result) => result.httpStatus === 200);
  const withMention = fetched.filter((result) => result.mentions > 0);
  const fetchedWithout = fetched.filter((result) => result.mentions === 0);
  const unreachable = results.filter((result) => result.httpStatus !== 200);

  console.log("\n--- summary ---------------------------------------------");
  console.log(`probed                        ${results.length}`);
  console.log(`fetched                       ${fetched.length}`);
  console.log(`  name present in the text    ${withMention.length}`);
  console.log(`  name absent                 ${fetchedWithout.length}`);
  console.log(`not retrievable               ${unreachable.length}`);
  console.log(`obtained via the proxy        ${results.filter((r) => r.via === "proxy").length}`);

  if (fetchedWithout.length > 0) {
    console.log("\nFetched but no mention found — read these by hand (embedded tweet, audio,");
    console.log("dynamic rendering, or the reference genuinely is not there):");
    for (const result of fetchedWithout) console.log(`  ${result.id}  ${result.publication}`);
  }
  if (unreachable.length > 0) {
    console.log("\nNot retrievable:");
    for (const result of unreachable) {
      console.log(`  ${result.id}  ${result.publication}  (${result.httpStatus || result.error})`);
    }
  }

  console.log(`\nReport written to ${REPORT_FILE}`);
  console.log(
    "\nA mention is NOT a verification: it means the string is on the page, not that the\n" +
      "article supports the record. Read the article before promoting anything, and fill\n" +
      "country, provenance and the featured criterion in the same edit (docs/DATA.md §7).",
  );
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
