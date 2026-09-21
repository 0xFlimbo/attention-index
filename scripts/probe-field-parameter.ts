/**
 * pnpm probe:fields
 *
 * One request, asked twice, to settle a single question:
 * **does `post.fields` return what `tweet.fields` does not?**
 *
 * The OpenAPI spec (`docs/X-API.md §0`) documents exactly one field parameter for
 * these endpoints — `post.fields`. `tweet.fields` appears in the spec on other
 * endpoints but not on these, where it nonetheless still works. Every request
 * this project has ever made sent `tweet.fields`, the legacy alias. The alias plainly still works for the classic
 * fields, but whether a *renamed* value like `note_post` survives validation
 * under the *old* parameter name has never been tested. A previous run concluded
 * "the field is unpopulated on this tier" from a response it did not keep, which
 * could not distinguish an empty field from a dropped request parameter.
 *
 * The subject is `@TheNatPulse` post `2073029000490815966`, chosen because its
 * true full text is known independently — the maintainer read it off the page —
 * so the response can be compared against the answer rather than against itself.
 *
 * Cost: **one post read, $0.005.** The second request is the same resource
 * inside the same 24-hour window, so the dedup rule (`§1`) makes it free.
 *
 * Both raw bodies are written to `research/`, which is the point as much as the
 * result is (`docs/X-API.md §15`).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const RESEARCH_DIR = resolve(ROOT, "research");
const OUT_DIR = resolve(RESEARCH_DIR, "api-probes");

const STATUS_ID = "2073029000490815966";
const FIELDS = "created_at,text,note_post,entities,public_metrics,author_id,display_text_range";
const CREDITS_URL = "https://api.x.com/2/usage/credits";

/** The true full text, read off the page by the maintainer on 2026-09-21. */
const KNOWN_FULL_TEXT_MARKER = "KEY QUOTE";

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

interface Attempt {
  parameter: string;
  url: string;
  http: number;
  body: unknown;
}

async function ask(parameter: string, token: string): Promise<Attempt> {
  const url = `https://api.x.com/2/tweets/${STATUS_ID}?${parameter}=${FIELDS}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { unparseable: text.slice(0, 400) };
  }
  return { parameter, url: url.replace(STATUS_ID, "<id>"), http: response.status, body };
}

function describe(attempt: Attempt): void {
  const data = (attempt.body as { data?: Record<string, unknown> })?.data;
  const errors = (attempt.body as { errors?: unknown[] })?.errors;
  console.log(`\n--- ${attempt.parameter} --- HTTP ${attempt.http}`);
  if (!data) {
    console.log("  no data object returned");
    console.log(`  body: ${JSON.stringify(attempt.body).slice(0, 300)}`);
    return;
  }
  console.log(`  keys returned: ${Object.keys(data).sort().join(", ")}`);
  const text = typeof data.text === "string" ? data.text : "";
  console.log(`  text length: ${text.length}`);
  console.log(`  note_post present: ${"note_post" in data}`);
  console.log(`  display_text_range present: ${"display_text_range" in data}`);
  const note = data.note_post as { text?: string } | string | undefined;
  const noteText = typeof note === "string" ? note : note?.text;
  console.log(`  note text length: ${noteText ? noteText.length : 0}`);
  const best = noteText && noteText.length > text.length ? noteText : text;
  console.log(`  reaches the end of the real post: ${best.includes(KNOWN_FULL_TEXT_MARKER)}`);
  if (errors) console.log(`  errors: ${JSON.stringify(errors).slice(0, 300)}`);
}

async function main(): Promise<void> {
  const token = loadBearerToken();
  const before = await balance(token);
  console.log(`balance before: ${before === null ? "unreadable" : `$${before.toFixed(2)}`}`);
  console.log(`probing post ${STATUS_ID} with fields: ${FIELDS}`);

  // Legacy alias first, so that if only one request ever lands it is the one
  // reproducing what every previous run did.
  const legacy = await ask("tweet.fields", token);
  describe(legacy);
  const current = await ask("post.fields", token);
  describe(current);

  const after = await balance(token);
  console.log(`\nbalance after:  ${after === null ? "unreadable" : `$${after.toFixed(2)}`}`);
  if (before !== null && after !== null) {
    console.log(`measured cost:  $${(before - after).toFixed(4)}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `field-parameter-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        probed_at: new Date().toISOString(),
        question: "does post.fields return what tweet.fields does not?",
        status_id: STATUS_ID,
        fields_requested: FIELDS,
        balance_before: before,
        balance_after: after,
        attempts: [legacy, current],
      },
      null,
      2,
    ),
  );
  console.log(`raw bodies: ${file}`);
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
