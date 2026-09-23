/**
 * pnpm refresh:metrics                          # plan: no request, no write
 * pnpm refresh:metrics -- --fetch               # buy one reading of every tracked post
 * pnpm refresh:metrics -- --from <file>         # use a reading already paid for
 * pnpm refresh:metrics -- --fetch --write       # ...and append it to data/posts.json
 * pnpm refresh:metrics -- --from <file> --write
 *
 * The manual metric refresh (docs/ENGINEERING.md §22). Never called during
 * `next build`, rendering, or CI, and never scheduled: B12 keeps the refresh
 * manual by maintainer decision (docs/WORKPLAN.md).
 *
 * **What it does.** One `GET /2/tweets?ids=` request per 100 tracked posts
 * returns each post's public counters. Each reading becomes one observation,
 * appended to that post's history with `source: "api"` and the reading's own
 * date, never replacing one (docs/DATA.md §5). The field mapping, including why
 * `reposts` counts quotes, lives in `src/lib/metrics/observation-refresh.ts`.
 *
 * **Planning is the default and spending is opt-in**, as in every paid tool
 * here. An unqualified run makes no request: it prints how many posts would be
 * read, what that costs, and which readings already paid for have not been
 * applied. `--fetch` is what bills, at $0.005 per post read (docs/X-API.md §6).
 *
 * **Reading and writing are separate steps.** `--fetch` and `--from` print, per
 * post, the latest stored reading beside the new one and write nothing to
 * `data/`. `--write` appends. So the ordinary sequence is to run it once, read
 * the table, then run `--from` on the file it just saved with `--write`, which
 * costs nothing a second time.
 *
 * **Why this one tool writes to `data/`.** Discovery tools never do, because a
 * candidate needs a human to verify it. A reading does not: it is a public
 * counter on a post already verified, and the only judgement in it — which
 * counter maps to which field — is made once, in code, and tested. It still
 * writes nothing that was not printed first.
 *
 * Every paid reading is kept in `research/post-metrics/`, in the same shape
 * `sweep:quotes --measure` already writes there, so a reading bought by either
 * tool can be applied by this one.
 *
 * Credentials: `X_BEARER_TOKEN` is read from `.env.local` only when `--fetch`
 * is passed, and is never logged, echoed, or written anywhere.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { postsFileSchema } from "../src/schemas/post.schema";
import {
  applyObservationAppends,
  planObservationAppends,
  statusIdFromUrl,
  type ApiPublicMetrics,
  type RefreshablePost,
  type RefreshOutcome,
} from "../src/lib/metrics/observation-refresh";
import { archiveEntry, rawArchivePath } from "../src/lib/sweep/raw-archive";

const ROOT = process.cwd();
const POSTS_FILE = resolve(ROOT, "data", "posts.json");
const RESEARCH_DIR = resolve(ROOT, "research");
const METRICS_DIR = resolve(RESEARCH_DIR, "post-metrics");
const BACKUP_DIR = resolve(ROOT, ".cache", "backups");

const LOOKUP_URL = "https://api.x.com/2/tweets";
const CREDITS_URL = "https://api.x.com/2/usage/credits";
/** The endpoint's own ceiling on ids per request. */
const IDS_PER_REQUEST = 100;
/** Per post returned, measured (docs/X-API.md §1, §6). */
const COST_PER_POST = 0.005;
/** The credit meter lags a billed request; read it again after a pause. */
const METER_SETTLE_MS = 5_000;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const doFetch = args.includes("--fetch");
const fromFile = flagValue("from");
const doWrite = args.includes("--write");

// ---------------------------------------------------------------------------
// Local files
// ---------------------------------------------------------------------------

/** The shape `sweep:quotes --measure` and this script both write. */
interface StoredReading {
  observed_at: string;
  source: string;
  data: { id: string; public_metrics?: ApiPublicMetrics }[];
}

function loadPosts(): { raw: string; posts: RefreshablePost[] } {
  const raw = readFileSync(POSTS_FILE, "utf-8");
  // Parsed only to validate. The object written back is the raw JSON, so fields
  // the schema would normalise are left exactly as they are on disk.
  const posts = JSON.parse(raw) as RefreshablePost[];
  if (!postsFileSchema.safeParse(posts).success) {
    console.error("data/posts.json failed schema validation — run `pnpm validate:data` first.");
    process.exit(1);
  }
  return { raw, posts };
}

function storedReadings(): string[] {
  if (!existsSync(METRICS_DIR)) return [];
  return readdirSync(METRICS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => resolve(METRICS_DIR, name));
}

function loadReading(file: string): StoredReading {
  const path = existsSync(file) ? file : resolve(METRICS_DIR, file);
  if (!existsSync(path)) {
    console.error(`No reading at ${file}. Stored readings are in research/post-metrics/.`);
    process.exit(1);
  }
  const reading = JSON.parse(readFileSync(path, "utf-8")) as StoredReading;
  if (!reading.observed_at || !Array.isArray(reading.data)) {
    console.error(`${path} is not a stored reading: it needs observed_at and a data array.`);
    process.exit(1);
  }
  return reading;
}

/** Same bytes as the file already uses: two-space JSON, trailing newline, its own line endings. */
function writePosts(raw: string, posts: RefreshablePost[]): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = resolve(BACKUP_DIR, stamp, "posts.json");
  mkdirSync(resolve(backup, ".."), { recursive: true });
  writeFileSync(backup, raw);

  const body = `${JSON.stringify(posts, null, 2)}\n`;
  writeFileSync(POSTS_FILE, raw.includes("\r\n") ? body.replace(/\n/g, "\r\n") : body);
  return backup;
}

// ---------------------------------------------------------------------------
// The X API
// ---------------------------------------------------------------------------

/** Reads X_BEARER_TOKEN from .env.local without ever logging it. */
function loadBearerToken(): string {
  const envPath = resolve(ROOT, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const token = line.match(/^X_BEARER_TOKEN=(.*)$/)?.[1]?.trim();
      if (token) return token;
    }
  }
  console.error("X_BEARER_TOKEN is missing from .env.local. See .env.example.");
  process.exit(1);
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

/** The balance is metered, not billed; the difference across a run is the real cost. */
async function readBalance(token: string): Promise<number | null> {
  try {
    const body = await getJson<{ data?: { total_balance?: number } }>(CREDITS_URL, token);
    return body.data?.total_balance ?? null;
  } catch {
    return null;
  }
}

/**
 * Buys the reading and keeps it before anything reads a field off it: the raw
 * response under `research/x-api-<day>/raw/`, and the reading itself in
 * `research/post-metrics/`, where this script and `sweep:quotes` both look.
 */
async function fetchReading(statusIds: string[], token: string): Promise<{ file: string; reading: StoredReading }> {
  const takenAt = new Date().toISOString();
  const data: StoredReading["data"] = [];
  for (let start = 0; start < statusIds.length; start += IDS_PER_REQUEST) {
    const ids = statusIds.slice(start, start + IDS_PER_REQUEST);
    const url = `${LOOKUP_URL}?ids=${ids.join(",")}&tweet.fields=public_metrics,created_at`;
    const body = await getJson<{ data?: StoredReading["data"]; errors?: unknown[] }>(url, token);
    // One label per batch: two responses in the same second under one label
    // would share a file name, and the second would overwrite the first.
    const label = `tracked-post-metrics-batch-${start / IDS_PER_REQUEST + 1}`;
    const entry = archiveEntry(url, label, body);
    const rawFile = resolve(RESEARCH_DIR, rawArchivePath(label, entry.fetched_at));
    mkdirSync(resolve(rawFile, ".."), { recursive: true });
    writeFileSync(rawFile, `${JSON.stringify(entry, null, 2)}\n`);
    data.push(...(body.data ?? []));
  }

  const reading: StoredReading = { observed_at: takenAt, source: "GET /2/tweets?ids=", data };
  mkdirSync(METRICS_DIR, { recursive: true });
  let file = resolve(METRICS_DIR, `tracked-post-metrics-${takenAt.slice(0, 10)}.json`);
  // A second reading the same day is kept beside the first, never over it.
  if (existsSync(file)) file = file.replace(/\.json$/, `-${takenAt.slice(11, 19).replace(/:/g, "")}.json`);
  writeFileSync(file, `${JSON.stringify(reading, null, 2)}\n`);
  return { file, reading };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const count = (n: number | null): string => (n === null ? "—" : n.toLocaleString("en-US"));

function printOutcomes(outcomes: RefreshOutcome[]): void {
  console.log(`\n  ${"post".padEnd(34)} ${"stored".padStart(24)}   ${"new reading".padStart(24)}`);
  for (const outcome of outcomes) {
    if (outcome.kind === "skip") {
      console.log(`  ${outcome.postId.padEnd(34)} skipped — ${outcome.reason}`);
      continue;
    }
    const before = `${count(outcome.previous.views)} (${outcome.previous.observed_at} ${outcome.previous.source})`;
    const after = `${count(outcome.observation.views)} (${outcome.observation.observed_at})`;
    console.log(`  ${outcome.postId.padEnd(34)} ${before.padStart(24)} → ${after.padStart(24)}`);
  }
  const appends = outcomes.filter((outcome) => outcome.kind === "append").length;
  console.log(`\n  ${appends} observation(s) to append, ${outcomes.length - appends} post(s) skipped.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (doFetch && fromFile) {
    console.error("Pass --fetch or --from, not both.");
    process.exit(1);
  }
  const { raw, posts } = loadPosts();
  const statusIds = posts.map((post) => statusIdFromUrl(post.url)).filter((id): id is string => id !== null);
  const latestStored = posts
    .flatMap((post) => post.observations.map((observation) => observation.observed_at))
    .sort()
    .at(-1);

  if (!doFetch && !fromFile) {
    const requests = Math.ceil(statusIds.length / IDS_PER_REQUEST);
    console.log("refresh:metrics — plan only. No request is made and nothing is written.\n");
    console.log(`  tracked posts with a status id   ${statusIds.length} of ${posts.length}`);
    console.log(`  requests a fetch would make      ${requests}`);
    console.log(`  modelled cost                    $${(statusIds.length * COST_PER_POST).toFixed(2)}`);
    console.log(`  latest stored observation        ${latestStored ?? "none"}`);
    const unapplied = storedReadings().filter(
      (file) => latestStored === undefined || loadReading(file).observed_at.slice(0, 10) > latestStored,
    );
    if (unapplied.length > 0) {
      console.log("\n  Readings already paid for and newer than anything stored — free to apply:");
      for (const file of unapplied) console.log(`    pnpm refresh:metrics -- --from ${basename(file)}`);
    }
    console.log("\n  To buy a new reading: pnpm refresh:metrics -- --fetch");
    return;
  }

  let reading: StoredReading;
  let readingFile: string;
  if (doFetch) {
    const token = loadBearerToken();
    const before = await readBalance(token);
    ({ file: readingFile, reading } = await fetchReading(statusIds, token));
    await new Promise((settle) => setTimeout(settle, METER_SETTLE_MS));
    const after = await readBalance(token);
    const metered = before !== null && after !== null ? `$${(before - after).toFixed(3)} metered` : "meter unreadable";
    console.log(
      `Bought ${reading.data.length} post reading(s): $${(reading.data.length * COST_PER_POST).toFixed(3)} modelled, ${metered}.`,
    );
    console.log(`Reading saved to ${readingFile}`);
  } else {
    readingFile = fromFile!;
    reading = loadReading(readingFile);
    console.log(`Reading from ${readingFile}, taken ${reading.observed_at}. No request is made.`);
  }

  const readings = new Map<string, ApiPublicMetrics>();
  for (const tweet of reading.data) if (tweet.public_metrics) readings.set(tweet.id, tweet.public_metrics);
  const outcomes = planObservationAppends(posts, readings, reading.observed_at.slice(0, 10));
  printOutcomes(outcomes);

  if (!outcomes.some((outcome) => outcome.kind === "append")) return;
  if (!doWrite) {
    console.log("\n  Nothing written. To append these readings to data/posts.json:");
    console.log(`    pnpm refresh:metrics -- --from ${basename(readingFile)} --write`);
    return;
  }

  const updated = applyObservationAppends(posts, outcomes);
  if (!postsFileSchema.safeParse(updated).success) {
    console.error("\n  The updated history fails schema validation. Nothing written.");
    process.exit(1);
  }
  const backup = writePosts(raw, updated);
  console.log(`\n  Appended. Previous file backed up to ${backup}`);
  console.log("  Next: the six commands (docs/USING.md §5, \"Refreshing the numbers by hand\").");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
