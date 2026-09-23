/**
 * pnpm import:press
 *
 * One-time / occasional seed of `data/media.json` from https://layoffhedge.com/press
 * (docs/TOOLS.md §5). Never fetched at build or runtime.
 *
 * The press page is plain server-rendered HTML: a flat grid of `<a class="press-card…">`
 * entries, each holding three inner `<div>`s (publication + date, title, factual context —
 * the "major coverage" variant adds a leading badge `<div>`, handled below). That
 * structure is regular enough to parse with a small amount of targeted regex; cheerio /
 * a scraping framework was not needed and was not installed (docs/ENGINEERING.md §1,
 * "Dependency gate").
 *
 * Every new record is written with `status: "needs_review"` and `verified_at: null`
 * (docs/DATA.md §3) — none of this counts toward public metrics until a maintainer
 * reviews and promotes it. Existing `media.json` records are preserved untouched, and
 * records are deduplicated by canonical article URL.
 *
 * Never invents a publication, title, author, date or URL: entries whose date on the
 * source page has only month/year precision (no day) are skipped and reported rather
 * than guessing a day-of-month, since docs/DATA.md requires a full ISO date.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { mediaSchema, mediaFileSchema, type MediaReference } from "../src/schemas/media.schema";
import { splitSyndicationSuffix } from "../src/lib/validation/publication-name";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const CACHE_DIR = resolve(ROOT, ".cache");
const PRESS_URL = "https://layoffhedge.com/press";

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

// ---------------------------------------------------------------------------
// HTML parsing (regex — the page's markup is flat and consistent; see header comment)
// ---------------------------------------------------------------------------

interface RawCard {
  url: string;
  outletDateText: string;
  title: string;
  context: string;
}

// Headlines carry em dashes, curly quotes and accented characters, so the decoder has to be
// general: a hand-picked list silently leaves raw `&mdash;` inside published titles.
const NAMED_ENTITIES: Record<string, string> = {
  middot: "·", quot: '"', apos: "'", starf: "★", lt: "<", gt: ">",
  mdash: "—", ndash: "–", nbsp: " ", hellip: "…", shy: "",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", sbquo: "‚", bdquo: "„",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", ccedil: "ç",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  auml: "ä", ouml: "ö", uuml: "ü", euro: "€", pound: "£", deg: "°", trade: "™", reg: "®", copy: "©",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/<[^>]+>/g, "") // strip any nested tags (e.g. the major-coverage badge line)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/&amp;/g, "&") // last, so a decoded entity is never decoded twice
    .replace(/\s+/g, " ")
    .trim();
}

/** Extracts every `press-card` entry's href and its 3 content divs (outlet/date, title, context). */
function parsePressCards(html: string): RawCard[] {
  const cards: RawCard[] = [];
  const cardRe = /<a\s+href="([^"]+)"[^>]*class="press-card[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardRe.exec(html))) {
    const url = cardMatch[1];
    const inner = cardMatch[2];
    if (!url || !inner) continue;

    const divRe = /<div[^>]*>([\s\S]*?)<\/div>/g;
    const divs: string[] = [];
    let divMatch: RegExpExecArray | null;
    while ((divMatch = divRe.exec(inner))) {
      const text = divMatch[1];
      if (text !== undefined) divs.push(decodeEntities(text));
    }
    // The "major coverage" variant has a leading badge div ("★ Major Coverage") before
    // the usual outlet/title/context triple — drop it so both variants line up.
    const [outletDateText, title, context] = divs.length === 4 ? divs.slice(1) : divs;
    if (!outletDateText || !title || !context) continue;
    cards.push({ url, outletDateText, title, context });
  }
  return cards;
}

type DatePrecision = "day" | "month" | "unknown";

function parseOutletDate(outletDateText: string): {
  outlet: string;
  dateText: string;
  precision: DatePrecision;
  iso: string | null;
} {
  const parts = outletDateText.split("·").map((part) => part.trim());
  const outlet = parts[0] ?? outletDateText;
  const dateText = parts[1] ?? "";
  const fullDate = dateText.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/);
  if (fullDate) {
    const [, mon, day, year] = fullDate;
    const monthNum = mon ? MONTHS[mon] : undefined;
    if (monthNum && day && year) {
      return { outlet, dateText, precision: "day", iso: `${year}-${monthNum}-${day.padStart(2, "0")}` };
    }
  }
  const monthYear = dateText.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (monthYear) {
    return { outlet, dateText, precision: "month", iso: null };
  }
  return { outlet, dateText, precision: "unknown", iso: null };
}

/** Strips a leading "By NAME." (optionally ", syndicated from X") byline into a separate field. */
function extractAuthor(context: string): { author: string | null; context: string } {
  // `context` has already been flattened to a single line by decodeEntities, so `.` is safe here.
  if (!context.startsWith("By ")) return { author: null, context };
  const afterBy = context.slice(3);

  // The byline ends at the first period that is not a middle initial: "By Mark J. Harvilla."
  // must yield "Mark J. Harvilla", not "Mark J" with "Harvilla." leaking into the context.
  let cut = -1;
  for (let i = afterBy.indexOf("."); i !== -1; i = afterBy.indexOf(".", i + 1)) {
    const isMiddleInitial = i >= 1 && /[A-Z]/.test(afterBy[i - 1] ?? "") && !/[A-Za-z]/.test(afterBy[i - 2] ?? " ");
    if (!isMiddleInitial) {
      cut = i;
      break;
    }
  }
  if (cut === -1) return { author: null, context };

  const namePart = afterBy.slice(0, cut);
  const rest = afterBy.slice(cut + 1).trim();
  const syndicationMatch = namePart.match(/^(.*?),\s*(syndicated from .+)$/i);
  if (syndicationMatch) {
    const name = syndicationMatch[1]?.trim() ?? namePart.trim();
    const syndication = syndicationMatch[2] ?? "";
    const capitalized = syndication.charAt(0).toUpperCase() + syndication.slice(1);
    return { author: name, context: `${capitalized}. ${rest}`.trim() };
  }
  return { author: namePart.trim(), context: rest.trim() };
}

/**
 * The press page describes its own coverage in first person ("our investigation",
 * "embeds our @LayoffAI post"). This site is independent of LayoffHedge
 * (docs/EDITORIAL.md §2, "possessive framing"), so a mechanical, conservative substitution
 * removes the possessive without rewriting or reinterpreting the underlying claim.
 */
function normalizeVoice(context: string): string {
  return context.replace(/\bour\b/g, "LayoffHedge's");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectReferenceType(url: string, outlet: string, title: string, context: string): MediaReference["reference_type"] {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "podcast";
  const blob = `${outlet} ${title} ${context}`.toLowerCase();
  if ((host.includes("x.com") || host.includes("twitter.com")) && /segment|broadcast|anchor|on-air/.test(blob)) {
    return "broadcast";
  }
  return "article";
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchPressPage(): Promise<{ ok: true; html: string } | { ok: false; reason: string }> {
  try {
    const response = await fetch(PRESS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LayoffHedgeAttentionIndex/1.0; +https://github.com/0xFlimbo/attention-index)" },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status} ${response.statusText}` };
    }
    const html = await response.text();
    return { ok: true, html };
  } catch (error) {
    return { ok: false, reason: `network error: ${(error as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Data I/O
// ---------------------------------------------------------------------------

function readExistingMedia(): MediaReference[] {
  const raw = JSON.parse(readFileSync(resolve(DATA_DIR, "media.json"), "utf-8")) as unknown;
  const parsed = mediaFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("data/media.json failed schema validation — run `pnpm validate:data` first. Aborting.");
    process.exit(1);
  }
  return raw as MediaReference[]; // preserve exact original shape for records left untouched
}

function canonicalUrl(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

function writeMediaFile(records: MediaReference[]): void {
  writeFileSync(resolve(DATA_DIR, "media.json"), `${JSON.stringify(records, null, 2)}\n`);
}

function backupMediaFile(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(CACHE_DIR, "backups", timestamp);
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(resolve(backupDir, "media.json"), readFileSync(resolve(DATA_DIR, "media.json")));
  return backupDir;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const existing = readExistingMedia();
  const existingUrls = new Set(existing.map((record) => canonicalUrl(record.url)));

  const fetchResult = await fetchPressPage();
  if (!fetchResult.ok) {
    console.error(`Could not fetch ${PRESS_URL}: ${fetchResult.reason}`);
    console.error("data/media.json left unchanged (currently " + JSON.stringify(existing.length) + " record(s)).");
    process.exit(1);
  }

  const cards = parsePressCards(fetchResult.html);
  if (cards.length === 0) {
    console.error(`Fetched ${PRESS_URL} but found no parseable press-card entries. Page structure may have changed.`);
    console.error("data/media.json left unchanged.");
    process.exit(1);
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(resolve(CACHE_DIR, "press-page.html"), fetchResult.html);

  console.log(`Fetched ${PRESS_URL}: ${cards.length} press-card entr${cards.length === 1 ? "y" : "ies"} found.`);

  const added: MediaReference[] = [];
  const skippedDuplicate: string[] = [];
  const skippedDatePrecision: string[] = [];
  const skippedUnparseableDate: string[] = [];
  const publicationCounts = new Map<string, number>();
  const usedIds = new Set(existing.map((record) => record.id));
  const seenInThisRunByUrl = new Set<string>();

  for (const card of cards) {
    const key = canonicalUrl(card.url);
    if (existingUrls.has(key) || seenInThisRunByUrl.has(key)) {
      skippedDuplicate.push(card.url);
      continue;
    }
    seenInThisRunByUrl.add(key);

    const { outlet, dateText, precision, iso } = parseOutletDate(card.outletDateText);
    if (precision === "month") {
      skippedDatePrecision.push(`${outlet} · ${dateText} — ${card.title} (${card.url})`);
      continue;
    }
    if (precision === "unknown" || !iso) {
      skippedUnparseableDate.push(`${card.outletDateText} — ${card.title} (${card.url})`);
      continue;
    }

    const { author, context: contextAfterAuthor } = extractAuthor(card.context);
    const context = normalizeVoice(contextAfterAuthor);
    const referenceType = detectReferenceType(card.url, outlet, card.title, card.context);

    // docs/DATA.md §7: the press page writes provenance into the outlet
    // name ("Inkl (via IBTimes UK)"). That belongs in `provenance` /
    // `syndicated_from`, not in a publication name — docs/EDITORIAL.md §5
    // requires the outlet's standard public form — so the suffix is split off
    // here rather than imported and cleaned up by hand afterwards.
    const { publication, syndicatedFrom } = splitSyndicationSuffix(outlet);

    let id = `media-${slugify(publication)}-${iso}`;
    if (usedIds.has(id)) {
      let suffix = 2;
      while (usedIds.has(`${id}-${suffix}`)) suffix++;
      id = `${id}-${suffix}`;
    }
    usedIds.add(id);

    const record: MediaReference = {
      id,
      publication,
      title: card.title,
      reference_type: referenceType,
      published_at: iso,
      url: card.url,
      author,
      country: null,
      // Imported records land unverified, so provenance stays undetermined
      // unless the outlet name itself already stated it. Determining it for
      // the rest is part of reading the article (docs/DATA.md §7).
      provenance: syndicatedFrom === null ? null : "syndicated",
      syndicated_from: syndicatedFrom,
      // Same rule for the cited work (docs/DATA.md §7): the press card says a piece exists,
      // never which of LayoffHedge's works it used. Reading that off a card
      // would be a guess, so it stays undetermined until the article is read.
      cited_work: null,
      context: context.length > 0 ? context : null,
      related_post_id: null,
      featured: false,
      logo: null,
      archive_url: null,
      notes: null,
      status: "needs_review",
      verified_at: null,
    };

    const validation = mediaSchema.safeParse(record);
    if (!validation.success) {
      console.error(
        `Skipping ${card.url} — built record failed schema validation: ` +
          validation.error.issues.map((issue) => issue.message).join("; "),
      );
      continue;
    }

    added.push(record);
    publicationCounts.set(publication, (publicationCounts.get(publication) ?? 0) + 1);
  }

  console.log(`\nDiscovered: ${cards.length}`);
  console.log(`Added: ${added.length}`);
  console.log(`Duplicates skipped (already in media.json or repeated on the page): ${skippedDuplicate.length}`);
  console.log(`Skipped — month/year-only date, day precision unavailable: ${skippedDatePrecision.length}`);
  for (const line of skippedDatePrecision) console.log(`  - ${line}`);
  if (skippedUnparseableDate.length > 0) {
    console.log(`Skipped — unparseable date: ${skippedUnparseableDate.length}`);
    for (const line of skippedUnparseableDate) console.log(`  - ${line}`);
  }

  if (added.length > 0) {
    console.log("\nPublication counts (this run's additions only):");
    for (const [publication, count] of [...publicationCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${publication}: ${count}`);
    }

    const backupDir = backupMediaFile();
    console.log(`\nBacked up data/media.json to ${backupDir}`);

    const combined = [...existing, ...added];
    writeMediaFile(combined);
    console.log(`Wrote data/media.json — ${combined.length} total record(s) (${added.length} new, all needs_review).`);
  } else {
    console.log("\nNo new records to add. data/media.json left unchanged.");
  }
}

main().catch((error) => {
  console.error(`Unexpected error: ${(error as Error).message}`);
  process.exit(1);
});
