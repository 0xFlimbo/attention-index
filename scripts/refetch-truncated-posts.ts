/**
 * pnpm refetch:truncated [-- --dry-run]
 *
 * One-off repair, **already executed on 2026-09-21**. Kept because it is the
 * record of how a documented-but-empty field was proven empty, and because the
 * same shape re-runs if `note_post` is ever populated on a future tier.
 *
 * It re-fetched the Track A posts whose stored `text` looked like a long-form
 * stub, asking for `note_post` and `entities`, and wrote the result to
 * `research/x-api-2026-09-20/track-a-full-text.json`.
 *
 * ---------------------------------------------------------------------------
 * **What it found, which is not what it was built to find.**
 *
 * - **`note_post` returned nothing.** 48 posts, **0 characters recovered**, every
 *   one. The field is in the OpenAPI enum, the request is accepted, and it is
 *   not populated here. A spec proves a field exists, never that it is served.
 * - **The selection heuristic was wrong.** "Text ending in a bare t.co link"
 *   is usually an ordinary post with an attached photo, not a stub.
 * - **What the 48 really were:** 28 of them link `layoffhedge.com` without
 *   naming it in prose. They matched Track A through the `url:` operator, which
 *   reads `url`/`expanded_url`, never the visible text. By follower count they
 *   are overwhelmingly `$LAYOFF` token promotion plus a few genuine tool users —
 *   the "bare link, no act of its own" shape already archived on sight. The
 *   original screening was correct and no record had been missed.
 * - **Post reads bill at exactly $0.005.** No user reads, no counts calls:
 *   `usage/credits` read $1.02 before and $0.78 after, for 48 posts. Exact to
 *   the cent, and it closed an open unknown carried since the first session.
 *
 * Cost: $0.2400, authorised in advance. `note_post` itself was never an extra
 * charge — billing is per resource returned — but the 24-hour dedup window from
 * 2026-09-20 had expired, so the posts were billed again.
 * ---------------------------------------------------------------------------
 *
 * Read-only against `data/`. Writes only to `research/`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const RESEARCH_DIR = resolve(ROOT, "research");
const DISCOVERY = resolve(RESEARCH_DIR, "x-api-2026-09-20", "discovery.json");
const OUT = resolve(RESEARCH_DIR, "x-api-2026-09-20", "track-a-full-text.json");
const LEDGER = resolve(RESEARCH_DIR, "x-api-2026-09-20", "cost-ledger.json");

const LOOKUP_URL = "https://api.x.com/2/tweets";
const CREDITS_URL = "https://api.x.com/2/usage/credits";
const isDryRun = process.argv.includes("--dry-run");

/** The project's own names, exactly as the Track A query used them. */
const PROJECT_NEEDLE = /layoffhedge|@?layoffai/i;

interface ApiTweet {
  id: string;
  author_id?: string;
  created_at?: string;
  text?: string;
  note_post?: { text?: string } | string;
  /** The same content under the legacy vocabulary, when `tweet.fields` was sent. */
  note_tweet?: { text?: string } | string;
  entities?: Record<string, unknown>;
  public_metrics?: Record<string, number>;
}

function loadBearerToken(): string {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found.");
    process.exit(1);
  }
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^X_BEARER_TOKEN=(.*)$/);
    if (match && (match[1] ?? "").trim().length > 0) return match[1]!.trim();
  }
  console.error("X_BEARER_TOKEN is missing or empty in .env.local.");
  process.exit(1);
}

async function balance(token: string): Promise<number | null> {
  try {
    const response = await fetch(CREDITS_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { total_balance?: number } };
    return body.data?.total_balance ?? null;
  } catch {
    return null;
  }
}

/**
 * The selection heuristic, **kept as written and known to be wrong**.
 *
 * It treats a post whose `text` ends in a bare t.co link as a stub. Measured
 * afterwards: that shape is usually an ordinary post with an attached photo, and
 * the t.co is the attachment. It is preserved rather than corrected because this
 * script is the record of a run that already happened, and rewriting the filter
 * would misdescribe which 48 posts were bought.
 */
function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  return /…$/.test(trimmed) || (trimmed.length > 250 && /https:\/\/t\.co\/\w+$/.test(trimmed));
}

function fullText(tweet: ApiTweet): string {
  const stub = (tweet.text ?? "").trim();
  // Both vocabularies, because the API mirrors whichever parameter name was
  // sent: `post.fields` yields `note_post`, `tweet.fields` yields `note_tweet`.
  // Reading only one is the bug that cost this project the text it had paid for.
  const raw = tweet.note_post ?? tweet.note_tweet;
  const note = typeof raw === "string" ? raw : raw?.text;
  const full = (note ?? "").trim();
  return full.length > stub.length ? full : stub;
}

async function main(): Promise<void> {
  const token = loadBearerToken();
  const discovery = JSON.parse(readFileSync(DISCOVERY, "utf-8"));
  const tweets: ApiTweet[] = discovery.data ?? discovery.tweets ?? [];
  const users: { id: string; username: string; name: string }[] =
    discovery.includes?.users ?? discovery.users ?? [];
  const byAuthor = new Map(users.map((user) => [user.id, user]));

  // Only the posts where the answer is actually missing: truncated AND the
  // visible text never names the project. A stub that already shows the name
  // was screened on enough, and re-buying it would be spending for nothing.
  const targets = tweets.filter(
    (tweet) => looksTruncated(tweet.text ?? "") && !PROJECT_NEEDLE.test(tweet.text ?? ""),
  );

  console.log(`${tweets.length} Track A posts on disk`);
  console.log(
    `${targets.length} match the stub heuristic and never name the project in visible text ` +
      "(the heuristic over-selects — see the note on looksTruncated)",
  );
  console.log(`estimated cost: ${targets.length} post reads ≈ $${(targets.length * 0.005).toFixed(2)}\n`);

  if (isDryRun) {
    console.log("DRY RUN — nothing fetched.");
    return;
  }
  if (targets.length === 0) return;

  const before = await balance(token);
  console.log(`balance before: ${before === null ? "unreadable" : `$${before.toFixed(2)}`}`);

  const recovered: Record<string, unknown>[] = [];
  const ledgerEntries: Record<string, unknown>[] = [];
  /** Untouched response bodies — the evidence the first run failed to keep. */
  const rawBodies: unknown[] = [];

  for (let index = 0; index < targets.length; index += 100) {
    const batch = targets.slice(index, index + 100);
    const url =
      `${LOOKUP_URL}?ids=${batch.map((tweet) => tweet.id).join(",")}` +
      `&post.fields=created_at,text,note_post,entities,public_metrics`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const bodyText = await response.text();
    if (!response.ok) {
      console.error(`  HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 200)}`);
      break;
    }
    const body = JSON.parse(bodyText) as { data?: ApiTweet[] };
    rawBodies.push(body);
    const returned = body.data ?? [];
    ledgerEntries.push({
      at: new Date().toISOString(),
      label: "refetch truncated Track A posts with note_post",
      endpoint: "/2/tweets",
      http: response.status,
      posts: returned.length,
      users: 0,
      costHigh: returned.length * 0.005,
      costLow: returned.length * 0.005,
      rateLimit: response.headers.get("x-rate-limit-limit"),
      rateRemaining: response.headers.get("x-rate-limit-remaining"),
    });

    for (const tweet of returned) {
      const author = tweet.author_id ? byAuthor.get(tweet.author_id) : undefined;
      const before_ = (tweets.find((t) => t.id === tweet.id)?.text ?? "").trim();
      const after = fullText(tweet);
      recovered.push({
        id: tweet.id,
        account: author ? `@${author.username}` : null,
        name: author?.name ?? null,
        created_at: tweet.created_at,
        url: author ? `https://x.com/${author.username}/status/${tweet.id}` : null,
        stored_text: before_,
        full_text: after,
        recovered_characters: Math.max(0, after.length - before_.length),
        names_project_in_full_text: PROJECT_NEEDLE.test(after),
        names_project_in_stored_text: PROJECT_NEEDLE.test(before_),
        public_metrics: tweet.public_metrics ?? null,
        entities: tweet.entities ?? null,
      });
    }
  }

  const after = await balance(token);
  console.log(`balance after:  ${after === null ? "unreadable" : `$${after.toFixed(2)}`}`);
  if (before !== null && after !== null) {
    console.log(`measured cost:  $${(before - after).toFixed(4)}`);
  }

  mkdirSync(resolve(RESEARCH_DIR, "x-api-2026-09-20"), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        // The request as sent, so a later reader can tell what was actually asked
        // for rather than inferring it from what came back.
        request_fields: "created_at,text,note_post,entities,public_metrics",
        request_parameter: "post.fields",
        posts: recovered,
        // Added 2026-09-21: the first run of this script kept only its conclusions,
        // which made "was `note_post` empty, or silently dropped?" unanswerable
        // without paying again. A response body is a paid reading.
        raw_responses: rawBodies,
      },
      null,
      2,
    ),
  );

  // Append to the existing ledger rather than starting a new one: it is the
  // record of everything this project has ever spent.
  if (existsSync(LEDGER) && ledgerEntries.length > 0) {
    const ledger = JSON.parse(readFileSync(LEDGER, "utf-8")) as unknown[];
    writeFileSync(LEDGER, JSON.stringify([...ledger, ...ledgerEntries], null, 2));
  }

  const gained = recovered.filter((row) => row.names_project_in_full_text && !row.names_project_in_stored_text);
  console.log(`\n${recovered.length} posts recovered -> ${OUT}`);
  console.log(`${gained.length} now visibly name the project and did not before:\n`);
  for (const row of gained) {
    console.log(`  ${row.account}  ${row.name}  (+${row.recovered_characters} chars)`);
    console.log(`    ${row.url}`);
  }
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
