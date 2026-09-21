/**
 * Matching a quoting account against the public register of U.S. legislators
 * (docs/WORKPLAN.md B10, Track B).
 *
 * Pure, like `quote-candidates.ts`: it takes CSV text and returns an index, so
 * the script owns the file reading and this can be tested without touching disk.
 *
 * ---------------------------------------------------------------------------
 * Why this matches on **names**, when the same source file carries handles and
 * numeric account ids that would be exact.
 *
 * Measured 2026-09-21 against the 456 profiles paid for to date:
 *
 * - matching by handle    -> **0 hits**
 * - matching by twitter_id -> **0 hits**
 * - and yet the set contains `@Rep_Davidson`, a sitting U.S. Representative
 *   who is in the register.
 *
 * He is in it as `WarrenDavidson`, with that account's id. He amplified from
 * `@Rep_Davidson`, a different account with a different id. `congress-legislators`
 * deliberately records only taxpayer-funded official accounts, so every campaign
 * account, personal account and second official-looking handle is absent — and
 * keying on either the handle or the id inherits that gap exactly.
 *
 * The display name does not: `@Rep_Davidson` is named "Rep. Warren Davidson".
 * A legislator's *name* is stable across every account they open, which is the
 * one thing about them that a register can rely on.
 *
 * This is why a handle miss means nothing at all, and is never evidence that an
 * account is not an officeholder (`docs/X-API.md §7`).
 * ---------------------------------------------------------------------------
 *
 * **A match is a reason to look, never a verification.** Names collide, and the
 * historical register runs to twelve thousand people since 1789, so an ordinary
 * member of the public can share a name with a nineteenth-century congressman.
 * `docs/X-API.md §9` step 4 still applies without exception: identity is
 * confirmed by independent sources, off-API, by a human.
 */

export interface Legislator {
  /** As printed in the register — the form a display name would carry. */
  fullName: string;
  firstName: string;
  lastName: string;
  /** `current` sits in Congress today; `historical` served at some point since 1789. */
  era: "current" | "historical";
  /** `rep` | `sen`, as the register spells it. */
  chamber: string;
  state: string;
  /** The official handle, where the register holds one. Absent for most historical members. */
  handle: string | null;
  /** The official account's numeric id, where the register holds one. */
  accountId: string | null;
}

export interface LegislatorMatch {
  legislator: Legislator;
  /** Which signal fired. `name` is the only one with useful recall — see the note above. */
  matchedOn: "name" | "handle" | "account-id";
}

/**
 * Shortest surname allowed to match on name.
 *
 * **Lowered from 4 to 3 on 2026-09-21, after it hid a sitting congressman.**
 * The calibration sweep surfaced `@chiproytx` — display name "Chip Roy",
 * 536,170 followers, bio "Congressman from the Great State of Texas" — and the
 * register match did not fire, although the register holds `Roy,Chip` exactly.
 * `Roy` is three characters. Only the bio role-phrase caught him, and the run
 * was very nearly reported as finding no officeholder at all.
 *
 * The floor's original reasoning was that surnames like `Lee`, `Kim`, `Cox` and
 * `Fry` are too common as ordinary words to carry signal. That reasoning ignores
 * the check immediately below it: a name match already requires the **first name
 * too**, as a whole word, so a hit needs an account actually called "Chip Roy",
 * not one that merely contains "roy". The floor was redundant protection paid
 * for in recall.
 *
 * Measured before changing it, which is the only reason to believe the trade:
 *
 * ```text
 * sitting members with a 3-letter surname   12   Chu, Lee x3, Kim x2, Roy, Fry,
 *                                                Amo, Min, Pou  — all invisible
 * new matches across 657 paid profiles       2   both genuinely Chip Roy
 * false positives                            0
 * ```
 *
 * Two of the twelve are U.S. Senators. Kept at 3 rather than removed entirely so
 * that a one- or two-character surname cannot match, where the whole-word
 * protection thins out.
 */
const MIN_SURNAME_LENGTH = 3;

/** Lowercase, strip punctuation and honorifics' full stops, collapse whitespace. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A minimal RFC-4180 reader: quoted fields may contain commas, and a doubled
 * quote inside a quoted field is one literal quote. The register's `address`
 * column contains commas, so a naive split corrupts every column after it.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.some((cell) => cell.length > 0))
    .map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

/**
 * Builds the index from the two register CSVs. Both are free and re-downloadable
 * from `unitedstates/congress-legislators`; neither costs an API call.
 *
 * The historical file is included deliberately. This project records former
 * officeholders — the Chaffetz rule — and three of its political records are
 * people who have left office, one of whom now posts as `@FmrRepMTG`. An index
 * of the current Congress alone would miss the population the dataset actually
 * holds.
 */
export function buildLegislatorIndex(currentCsv: string, historicalCsv: string): Legislator[] {
  const read = (text: string, era: Legislator["era"]): Legislator[] =>
    parseCsv(text)
      .map((record) => ({
        fullName: (record.full_name || `${record.first_name} ${record.last_name}`).trim(),
        firstName: record.first_name ?? "",
        lastName: record.last_name ?? "",
        era,
        chamber: record.type ?? "",
        state: record.state ?? "",
        handle: record.twitter ? record.twitter.toLowerCase() : null,
        accountId: record.twitter_id || null,
      }))
      .filter((legislator) => legislator.lastName.length > 0);

  return [...read(currentCsv, "current"), ...read(historicalCsv, "historical")];
}

export interface AccountToMatch {
  /** The X display name — the field that carries the real name. */
  name: string;
  username: string;
  /** The numeric author id, which arrives free with every enumerated quote. */
  authorId?: string;
}

/**
 * Every legislator this account could be, most reliable signal first.
 *
 * Returns all matches rather than the first: a name can belong to more than one
 * person in a register spanning 1789 to today, and collapsing that to one guess
 * would hide exactly the ambiguity a human needs to see.
 */
export function matchLegislators(
  account: AccountToMatch,
  index: Legislator[],
): LegislatorMatch[] {
  const matches: LegislatorMatch[] = [];
  const handle = account.username.toLowerCase();
  const normalizedName = normalize(account.name);

  for (const legislator of index) {
    if (legislator.accountId && account.authorId && legislator.accountId === account.authorId) {
      matches.push({ legislator, matchedOn: "account-id" });
      continue;
    }
    if (legislator.handle && legislator.handle === handle) {
      matches.push({ legislator, matchedOn: "handle" });
      continue;
    }

    const first = normalize(legislator.firstName);
    const last = normalize(legislator.lastName);
    if (last.length < MIN_SURNAME_LENGTH || first.length === 0) continue;
    // Both names, as whole words, in either order — "Rep. Warren Davidson" and
    // "Davidson, Warren" both match, "Davidson Motors" does not.
    if (hasWord(normalizedName, first) && hasWord(normalizedName, last)) {
      matches.push({ legislator, matchedOn: "name" });
    }
  }
  return matches;
}

/** Whole-word containment on an already-normalized haystack. */
function hasWord(haystack: string, word: string): boolean {
  if (word.length === 0) return false;
  return ` ${haystack} `.includes(` ${word} `);
}
