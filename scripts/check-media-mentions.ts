/**
 * pnpm check:media-mentions [-- --status needs_review] [-- --id <media-id>]
 *                           [-- --urls <file>] [-- --limit N] [-- --delay MS]
 *                           [-- --no-proxy]
 *
 * Occasional maintenance tool (docs/TOOLS.md §6). Never called during
 * `next build`, rendering, or CI.
 *
 * **Strictly read-only.** It fetches each selected page and reports whether the
 * page's own text names this project. It never writes to `data/` — promotion
 * stays a human edit, and a discovery sweep is exactly where the temptation to
 * auto-promote would do the most damage.
 *
 * **Two inputs, one core.** Records already in `data/media.json` (by status or
 * id), or a plain list of URLs that are in no file yet (`--urls`). The second
 * mode is what the web-search discovery sweep hands off to (docs/ENGINEERING.md
 * §21), and what two throwaway scripts once did because it did not exist. The
 * fetch-and-detect half both modes share lives in `src/lib/sweep/page-probe.ts`;
 * what counts as a mention lives
 * in `src/lib/sweep/mention-patterns.ts`.
 *
 * **A hit is not a verification, and the report says so on every line.** It
 * means a form of the name is present on the page, not that the article
 * supports the record as written: the string could sit in a sidebar, a
 * related-links rail or an unrelated quote. What the tool buys is that the
 * reading starts from a fetched page with a located mention — each result now
 * carries the sentences around the match — instead of from a bare URL.
 *
 * **Weak forms are reported apart from brand forms.** `layoffhedge` and
 * `layoffai` do not occur by accident; "official layoff" and "layoff AI" do.
 * A page whose only hit is weak is listed separately, because treating the two
 * as one number is how a discovery sweep manufactures coverage that isn't there.
 *
 * Raw fetched text goes to the gitignored `.cache/`, never into canonical
 * JSON, so a second run over the same records is cheap to inspect by hand.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { mediaFileSchema } from "../src/schemas/media.schema";
import { probePage, sleep, type ProbeResult, type ProbeTarget } from "../src/lib/sweep/page-probe";
import { parseUrlList } from "../src/lib/sweep/url-list";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const CACHE_DIR = resolve(ROOT, ".cache");
const REPORT_FILE = resolve(CACHE_DIR, "media-mentions.json");
/**
 * The extracted text of every page this run fetched, one file per target.
 * The tool's point is that a human reading starts from a fetched page with a
 * located mention; keeping only the counts meant the reader had to fetch the
 * same URL a second time to do the reading the counts exist to enable.
 */
const PAGES_DIR = resolve(CACHE_DIR, "pages");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flagValue(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const urlsFile = flagValue("urls");
const statusFilter = flagValue("status") ?? "needs_review";
const idFilter = flagValue("id");
const limit = Number(flagValue("limit") ?? Number.POSITIVE_INFINITY);
// Default pacing is deliberately unhurried: the proxy throttles a burst, and a
// throttled response is indistinguishable from a blocked one in the report.
const delayMs = Number(flagValue("delay") ?? 3_000);
const useProxy = !args.includes("--no-proxy");

// ---------------------------------------------------------------------------
// Input modes
// ---------------------------------------------------------------------------

/** Writes a target's extracted text next to the report, for reading by hand. */
function saveText(target: ProbeTarget, text: string): string {
  mkdirSync(PAGES_DIR, { recursive: true });
  writeFileSync(resolve(PAGES_DIR, `${target.id}.txt`), [target.url, "", text, ""].join("\n"));
  return `.cache/pages/${target.id}.txt`;
}

function targetsFromMediaFile(): ProbeTarget[] {
  const raw = JSON.parse(readFileSync(resolve(DATA_DIR, "media.json"), "utf-8")) as unknown;
  const parsed = mediaFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "data/media.json failed schema validation — run `pnpm validate:data` first. Aborting.",
    );
    process.exit(1);
  }

  return parsed.data
    .filter((record) => (idFilter !== null ? record.id === idFilter : record.status === statusFilter))
    .map((record) => ({ id: record.id, publication: record.publication, url: record.url }));
}

function targetsFromUrlFile(file: string): ProbeTarget[] {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) {
    console.error(`URL list not found: ${file}`);
    process.exit(1);
  }
  const { targets, skipped } = parseUrlList(readFileSync(path, "utf-8"));
  for (const line of skipped) {
    console.log(`  line ${line.line} skipped — no http(s) URL: ${line.text.slice(0, 80)}`);
  }
  return targets;
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const selected = (urlsFile !== null ? targetsFromUrlFile(urlsFile) : targetsFromMediaFile()).slice(
    0,
    limit,
  );

  if (selected.length === 0) {
    console.log(
      urlsFile !== null
        ? `No usable URLs in ${urlsFile}.`
        : `No records matched (status "${statusFilter}"${idFilter ? `, id "${idFilter}"` : ""}).`,
    );
    return;
  }

  console.log(
    `Probing ${selected.length} ${urlsFile !== null ? "URL(s)" : "record(s)"} · ` +
      `proxy fallback ${useProxy ? "on" : "off"} · ${delayMs}ms between pages\n`,
  );

  const results: ProbeResult[] = [];
  for (const [index, target] of selected.entries()) {
    const result = await probePage(target, { useProxy, saveText });
    results.push(result);
    console.log(
      `${String(index + 1).padStart(3)}/${selected.length}  ` +
        `${String(result.httpStatus).padStart(3)}  ` +
        `${String(result.mentions.total).padStart(3)} mention(s) ` +
        `${result.mentions.brand ? "brand" : result.mentions.total > 0 ? "weak " : "     "}  ` +
        `${result.via.padEnd(6)}  ${result.publication}`,
    );
    if (index < selected.length - 1) await sleep(delayMs);
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(REPORT_FILE, `${JSON.stringify(results, null, 2)}\n`);

  const fetched = results.filter((result) => result.httpStatus === 200);
  const brand = fetched.filter((result) => result.mentions.brand);
  const weakOnly = fetched.filter((result) => !result.mentions.brand && result.mentions.total > 0);
  const absent = fetched.filter((result) => result.mentions.total === 0);
  const unreachable = results.filter((result) => result.httpStatus !== 200);

  console.log("\n--- summary ---------------------------------------------");
  console.log(`probed                        ${results.length}`);
  console.log(`fetched                       ${fetched.length}`);
  console.log(`  brand form on the page      ${brand.length}`);
  console.log(`  weak form only              ${weakOnly.length}`);
  console.log(`  name absent                 ${absent.length}`);
  console.log(`not retrievable               ${unreachable.length}`);
  console.log(`obtained via the proxy        ${results.filter((r) => r.via === "proxy").length}`);

  if (brand.length > 0) {
    console.log("\nBrand form found — read these first:");
    for (const result of brand) {
      console.log(`  ${result.id}  ${result.publication}`);
      const excerpt = result.mentions.excerpts[0];
      if (excerpt !== undefined) console.log(`      ${excerpt.slice(0, 200)}`);
    }
  }
  if (weakOnly.length > 0) {
    console.log(
      "\nOnly a weak form matched (the account's display name, or 'layoff AI' spaced).",
    );
    console.log("These are a reason to read the page, never on their own a reference:");
    for (const result of weakOnly) console.log(`  ${result.id}  ${result.publication}`);
  }
  if (absent.length > 0) {
    console.log("\nFetched but no mention found — read these by hand (embedded tweet, audio,");
    console.log("dynamic rendering, or the reference genuinely is not there):");
    for (const result of absent) console.log(`  ${result.id}  ${result.publication}`);
  }
  if (unreachable.length > 0) {
    console.log("\nNot retrievable:");
    for (const result of unreachable) {
      console.log(`  ${result.id}  ${result.publication}  (${result.httpStatus || result.error})`);
    }
  }

  console.log(`\nReport written to ${REPORT_FILE}`);
  console.log(
    "\nA mention is NOT a verification: it means a form of the name is on the page, not\n" +
      "that the article supports the record. Read the article before promoting anything,\n" +
      "and fill country, provenance and the featured criterion in the same edit\n" +
      "(docs/DATA.md §7).",
  );
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
