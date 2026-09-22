/**
 * What counts as this project's name on a page somebody else wrote.
 *
 * ---------------------------------------------------------------------------
 * **Why this is a module, and why the list grew.**
 *
 * `scripts/check-media-mentions.ts` looked for `layoffhedge` and `@?layoffai`
 * and nothing else. That list was derived from `data/media.json`, which is
 * derived from the official press page, so it was calibrated on the one sample
 * the web sweep exists to leave behind (`docs/WORKPLAN.md` B11).
 *
 * The measurement, 2026-09-22: counted over `data/media.json`, `layoffhedge`
 * appears 83 times, `layoffai` 99, **`layoff hedge` zero** — while the best
 * candidate the discovery probe turned up, `yourNEWS`, writes "According to
 * **Layoff Hedge**…", spaced. A detector that only knows the closed form
 * reports that page as carrying no mention at all, which is the one failure a
 * discovery sweep cannot afford: it does not produce a wrong record, it
 * produces a silence indistinguishable from "nobody cited us".
 *
 * **Strong and weak forms are separated rather than merged.** `layoffhedge`
 * and `layoffai` are brand tokens: they do not occur by accident. `official
 * layoff` is the X account's display name — the dataset records ZeroHedge
 * embedding "the Official Layoff / @LayoffAI post" — but it is also an
 * ordinary English phrase in layoff reporting ("the official layoff numbers"),
 * and "layoff AI" spaced is a phrase a piece about AI-driven layoffs can write
 * without meaning the account. Both are kept, because a page a human should
 * read is worth surfacing, and both are marked `weak`, because a report that
 * cannot tell the two apart hands the reader a hit that means nothing.
 * ---------------------------------------------------------------------------
 */

export interface MentionPattern {
  /** Stable key — it appears in the report, so it is a name and not an index. */
  name: string;
  regex: RegExp;
  /**
   * `true` when the form also occurs as ordinary prose. A weak hit is a reason
   * to read the page, never on its own a reason to believe the page cites this
   * project.
   */
  weak: boolean;
  /** Why the form is in the list, for whoever reads a report months later. */
  why: string;
}

/**
 * The separator a publisher may put inside the name: nothing, a space, a
 * non-breaking space, a hyphen, an underscore or a dot (the last two for slugs
 * and domains).
 */
const SEPARATOR = "[\\s\\u00a0._-]";

export const MENTION_PATTERNS: MentionPattern[] = [
  {
    name: "layoffhedge",
    regex: new RegExp(`layoff${SEPARATOR}?hedge`, "gi"),
    weak: false,
    why: "the brand word, closed or spaced — also matches layoffhedge.com and a URL slug",
  },
  {
    name: "layoffai",
    regex: /@?layoffai\b/gi,
    weak: false,
    why: "the X handle, closed — also matches an x.com/LayoffAI link in an embed",
  },
  {
    name: "layoff-ai-spaced",
    regex: new RegExp(`@?layoff${SEPARATOR}ai\\b`, "gi"),
    weak: true,
    why: 'the handle written as two words; also an ordinary phrase in "layoff AI tool"',
  },
  {
    name: "official-layoff",
    regex: /\bofficial\s+layoff\b/gi,
    weak: true,
    why: 'the account display name ("Official Layoff / @LayoffAI"); also ordinary prose',
  },
];

export interface MentionReport {
  /** Every match of every pattern. Forms overlap by design — see `byPattern`. */
  total: number;
  /** Per-pattern counts, so a weak hit can never be read as a brand hit. */
  byPattern: Record<string, number>;
  /** At least one non-`weak` pattern matched. */
  brand: boolean;
  /** Up to `EXCERPT_LIMIT` windows of text around a match, for reading by eye. */
  excerpts: string[];
}

const EXCERPT_RADIUS = 140;
const EXCERPT_LIMIT = 5;

/**
 * Counts the forms and keeps a few of them in context.
 *
 * The excerpts are the point of the whole tool: a count tells a reader the
 * string is on the page, and the sentence around it is the first thing that
 * can tell them whether the page is citing this project or listing it in a
 * sidebar. It still is not a verification — the article is opened and read
 * before anything is promoted (`docs/ENGINEERING.md §17`).
 */
export function detectMentions(text: string): MentionReport {
  const byPattern: Record<string, number> = {};
  const excerpts: string[] = [];
  let total = 0;
  let brand = false;

  for (const pattern of MENTION_PATTERNS) {
    // A fresh RegExp per call: a shared /g/ instance carries `lastIndex`.
    const scanner = new RegExp(pattern.regex.source, pattern.regex.flags);
    let count = 0;
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(text)) !== null) {
      count += 1;
      if (excerpts.length < EXCERPT_LIMIT) excerpts.push(excerptAround(text, match.index));
      if (match[0].length === 0) scanner.lastIndex += 1; // never loop on an empty match
    }
    byPattern[pattern.name] = count;
    total += count;
    if (count > 0 && !pattern.weak) brand = true;
  }

  return { total, byPattern, brand, excerpts };
}

/** The text around one match, trimmed to whole-ish words and marked when cut. */
export function excerptAround(text: string, index: number, radius = EXCERPT_RADIUS): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const body = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/**
 * Crude tag strip — enough to tell prose from markup; never parsed as HTML.
 * Moved here from the script so both input modes and both fetch routes see the
 * same text, which is what makes a hit in one mode comparable to a hit in the
 * other.
 */
export function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
