/**
 * The query set of the web sweep, versioned in the repo the way
 * `scripts/sweep-mentions.ts` keeps its one X API query: a different query is
 * a different population, and comparing two runs of different query sets
 * silently answers the wrong question.
 *
 * ---------------------------------------------------------------------------
 * **The measurement this set is built on (2026-09-22, six probe queries).**
 *
 * A brand query — `layoffhedge`, or the exact phrases "according to
 * layoffhedge" / "data from layoffhedge" — returns the project's own surfaces
 * and the outlets already in `data/media.json`. Nine results, **zero
 * candidates**. What produced candidates was querying **the claim that
 * travelled**, not the name: the "9 of every 10 new American jobs" cluster
 * returned four unknown domains from one query.
 *
 * So the instrument is the claim and the brand query is the **control**: it
 * tells you the index has the pages you already know about, which is how you
 * find out that a zero-candidate run means "nothing new" rather than "the
 * index does not have us".
 *
 * The clusters are not invented here. They are the `cited_work` values
 * `docs/DATA.md §7` already records — `layoff_data`, `h1b_data`,
 * `investigation` — so the query set widens exactly when the dataset does.
 *
 * **Measured against the live index, 2026-09-22, five billed queries.** Both
 * calibration targets came back: `jobs-foreign-born-4-in-5` returned exactly
 * one result and it was the yourNEWS page, and the Trine cluster returned the
 * second NewsBreak URL alongside the four records already in the file. Two
 * corrections came out of the same run and are applied above:
 *
 * - **A subject query returns the subject, not the citation.** "Trine
 *   University foreign student recruitment visas" returned 20 results of which
 *   16 were trine.edu's own pages and college-guide directories. Replaced with
 *   the investigation's own figure (`"9,123"`) and the agency it named
 *   (`Gurukul Overseas`) — strings only a piece *using the work* carries.
 * - **`brand-spaced` is low precision and low recall, and it stays as a
 *   control anyway.** "layoff hedge" is ordinary English: seven results, all
 *   of them a book title, a DEV post, an Instagram tag and Reddit threads, and
 *   `more_results_available: false` — the index held nothing else. It did
 *   **not** return the yourNEWS page, which contains the phrase. That is the
 *   index-thinness answer this project needed and it is worth $0.005 a sweep
 *   to keep taking.
 *
 * **Non-English discovery is not established.** A Spanish-language probe
 * returned pure noise and no candidate. The dataset holds a Spanish record
 * (`El Ecosistema Startup`) and a Hebrew one, so the population exists; what
 * does not exist is evidence that these queries reach it. `ES_UNPROVEN` below
 * is kept out of the default set and run by name, so it is measured rather
 * than assumed.
 * ---------------------------------------------------------------------------
 */

/**
 * Bumped whenever a query is added, removed or reworded. A sweep report
 * records it, so two reports are comparable only when this matches.
 */
export const QUERY_SET_VERSION = "2026-09-22.5";

export type QueryCluster =
  | "brand"
  | "layoff_data"
  | "h1b_data"
  | "investigation"
  | "company_story"
  | "unproven";

export interface SweepQuery {
  /** Stable name, used by `--query <label>` and printed in the report. */
  label: string;
  cluster: QueryCluster;
  /** The `q` value, verbatim. Exact phrases are quoted; `-site:` excludes. */
  q: string;
  /** Why this string and not another — the thing a rewrite must not lose. */
  why: string;
}

/**
 * The control. It should keep returning pages already in the file; the day it
 * returns nothing at all, the index changed and the claim queries below cannot
 * be trusted either.
 */
const BRAND: SweepQuery[] = [
  {
    label: "brand-closed",
    cluster: "brand",
    q: "layoffhedge -site:layoffhedge.com",
    why: "the brand token, the form 83 of the dataset's mentions use",
  },
  {
    label: "brand-spaced",
    cluster: "brand",
    q: '"layoff hedge" -site:layoffhedge.com',
    why: "the spaced form the dataset has zero of and the open web writes (yourNEWS)",
  },
  {
    label: "brand-handle",
    cluster: "brand",
    q: '"@LayoffAI"',
    why: "the handle as a publisher writes it when crediting an embedded post",
  },
  {
    label: "brand-domain",
    cluster: "brand",
    q: '"layoffhedge.com" -site:layoffhedge.com',
    why: "a page that links the site without naming it in prose",
  },
];

/**
 * The claim clusters. Each is a phrase a piece *reusing this project's work*
 * would carry, taken from records already in `data/media.json` — never a
 * phrase invented here, because a query nobody's article contains measures
 * nothing.
 */
const CLAIMS: SweepQuery[] = [
  {
    label: "jobs-foreign-born-8-in-10",
    cluster: "layoff_data",
    q: '"8 of every 10 new American jobs"',
    why: "the post's own sentence, quoted verbatim by yourNEWS; replaces a 9-in-10 phrasing the index returned zero results for",
  },
  {
    label: "jobs-foreign-born-4-in-5",
    cluster: "layoff_data",
    q: '"four out of every five" "new U.S. jobs"',
    why: "yourNEWS's phrasing of the same claim — the confirmed calibration hit",
  },
  {
    label: "jobs-foreign-born-90-percent",
    cluster: "layoff_data",
    q: '"90 percent" "post-COVID" jobs foreign-born',
    why: "The National Pulse's phrasing, the record already in the file",
  },
  {
    label: "daily-wire-layoffs",
    cluster: "layoff_data",
    q: '"Daily Wire" layoffs workforce "Ben Shapiro" viewership',
    why: "the Daily Wire cluster (IBTimes UK, Inkl, Candace Owens) — broadcast reach",
  },
  {
    label: "tech-jobs-107000",
    cluster: "layoff_data",
    q: '"107,000" tech jobs 2026 layoffs',
    why: "the Jensen Huang / 107,000 figure, carried by IBTimes UK and Inkl",
  },
  {
    label: "h1b-renewals-record",
    cluster: "h1b_data",
    q: '"273,026" H-1B renewals',
    why: "an exact figure only a piece using the renewals analysis can carry",
  },
  {
    label: "h1b-district-map",
    cluster: "h1b_data",
    q: '"H-1B" "congressional district" map filings Texas Republican',
    why: "the district-map cluster (Newsweek, India-West, The National Pulse)",
  },
  {
    label: "investigation-trine",
    cluster: "investigation",
    q: '"Trine University" foreign student recruitment visas',
    why: "returns the four records in the file AND the second NewsBreak URL — the calibration target",
  },
  {
    label: "investigation-trine-9123",
    cluster: "investigation",
    q: '"9,123" Trine graduate students',
    why: "the investigation's own count; precise, 3 known records of 5 results, but it misses the calibration target",
  },
];

/**
 * **The company-story cluster, and the gap it closes.**
 *
 * The first full sweep's queries covered `layoff_data`, `h1b_data` and
 * `investigation` — the territory of 31 of the 95 verified records. The other
 * **64 carry `cited_work: "none"`**, which does not mean they cite nothing: it
 * means the piece used no *named work*, and counted over their titles and
 * contexts they are overwhelmingly one shape — **a company's layoffs, where an
 * outlet cites this project for a number the company has not given**. Meta
 * appears in 23 of them, Disney and Visa in 5 each.
 *
 * The query set had no cluster for two thirds of the dataset. That is the gap.
 *
 * **Derived, not invented**, by the rule the first sweep measured: a query must
 * carry a string only a piece *using* this project's work would write. So each
 * one below is an exact figure this project published or an event this
 * project's account broke — never "Meta layoffs", which returns Meta's
 * layoffs.
 *
 * **This cluster is time-bound and is meant to be re-derived**, unlike the rest
 * of the set. Its subjects are whichever companies the dataset is currently
 * thick with; a year from now they will be different companies and these four
 * queries will be dead weight. The method to redo it: count the companies in
 * the `cited_work: "none"` records, then take each one's distinctive figure or
 * event out of the records' own `context` fields.
 *
 * ---------------------------------------------------------------------------
 * **RUN 2026-09-22, $0.020, and the result retired it from the default set.
 * The gap above is real; a web sweep is the wrong instrument for it.**
 *
 * Four queries, 55 distinct URLs, **45 candidates fetched — 0 brand hits.**
 * Not one new page names this project.
 *
 * The queries are not the problem, and the run proves it: each returned
 * records **already in the file** — Forbes on the 15,800 projection, Slay News
 * and Alex Jones Live on the leaked audio, Geeks + Gamers on the Disney
 * buyouts. They land exactly on target. What is not there is a population of
 * *other* pages carrying the name in prose.
 *
 * **Why, measured rather than guessed.** Of the 64 `cited_work: "none"`
 * records, **43 carry the reference as an embedded @LayoffAI post** — against
 * 8 in prose. The prose-dominant clusters are the ones the query set already
 * covers (`h1b_data` 9 of 14 prose, `layoff_data` 5 of 12). An embed puts the
 * name in a client-rendered card that is frequently not in the served HTML at
 * all, which is the same wall hit earlier when twelve records could not be read
 * from this environment.
 *
 * So a text-search index cannot reach this population **in principle**, not
 * for want of a better query. It is the web-sweep analogue of the split
 * `docs/PROVIDERS.md` already records: Track A finds those who cite in prose,
 * Track B finds those who quote in silence. **The instrument for the embed
 * population is the X API side, and it has already been run.**
 *
 * Kept defined and out of `SWEEP_QUERIES`, the way `ES_UNPROVEN` is: runnable
 * by name, never billed by default, and visible as *tested and answered*
 * rather than as an idea nobody got to. Re-run it only on evidence that this
 * population's habits changed.
 * ---------------------------------------------------------------------------
 */
export const COMPANY_STORIES: SweepQuery[] = [
  {
    label: "company-meta-15800",
    cluster: "company_story",
    q: '"15,800" Meta layoffs',
    why: "this project's own two-wave headcount projection — Glass Almanac and Forbes both carry it",
  },
  {
    label: "company-meta-leaked-audio",
    cluster: "company_story",
    q: 'Zuckerberg "leaked audio" all-hands layoffs',
    why: "the story the account broke; seven records embed that post (ZeroHedge, Digit, Slay News, The Deep Dive...)",
  },
  {
    label: "company-meta-ai-selection",
    cluster: "company_story",
    q: 'Meta layoffs lawsuit "medical leave" AI selected',
    why: "the AI-selection suits IBTimes UK and Inkl covered off two @LayoffAI posts",
  },
  {
    label: "company-disney-buyouts",
    cluster: "company_story",
    q: 'Disney executives "voluntary retirement" buyout layoffs',
    why: "five records across IBTimes UK, The Source, Geeks + Gamers and The American Bazaar",
  },
];

/** Kept out of the default set until a run measures it. */
export const ES_UNPROVEN: SweepQuery[] = [
  {
    label: "es-brand",
    cluster: "unproven",
    q: '"layoffhedge" despidos',
    why: "Spanish probe returned pure noise; this is the measurement, not the assumption",
  },
];

export const SWEEP_QUERIES: SweepQuery[] = [...BRAND, ...CLAIMS];

/**
 * Exact labels only, comma-separated.
 *
 * **This was substring matching and it billed twice what was asked for.**
 * `--query investigation-trine` matched `investigation-trine` *and*
 * `investigation-trine-backdoor`, so a run meant as one $0.005 probe made two
 * requests (measured 2026-09-22). On an API with no spending cap, a selector
 * that can silently widen is the wrong selector: an unknown label now returns
 * nothing and the caller is shown the list instead of being charged for a
 * guess.
 */
export function selectQueries(labels: string[]): { queries: SweepQuery[]; unknown: string[] } {
  const all = [...SWEEP_QUERIES, ...COMPANY_STORIES, ...ES_UNPROVEN];
  if (labels.length === 0) return { queries: SWEEP_QUERIES, unknown: [] };

  const wanted = labels.flatMap((label) => label.split(",")).map((label) => label.trim()).filter(Boolean);
  const queries = wanted
    .map((label) => all.find((query) => query.label === label))
    .filter((query): query is SweepQuery => query !== undefined);
  const unknown = wanted.filter((label) => !all.some((query) => query.label === label));
  return { queries, unknown };
}

export function allQueryLabels(): string[] {
  return [...SWEEP_QUERIES, ...COMPANY_STORIES, ...ES_UNPROVEN].map((query) => query.label);
}
