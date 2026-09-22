/**
 * What the web sweep has already paid to look at, so a repeat run does not buy
 * the back catalogue twice.
 *
 * ---------------------------------------------------------------------------
 * **The shape is borrowed from Track A and so is the rule that makes it safe.**
 *
 * `research/track-a-state.json` keeps a `since_id` high-water mark that moves
 * **only forwards and only after a successful run**, because a mark that moves
 * backwards re-buys a paid window and one that moves forwards after a failure
 * silently skips what nobody has seen (`docs/ENGINEERING.md §18a`). The same
 * two failure modes exist here, with a third that is specific to a query set.
 *
 * **The third one: a mark belongs to a query, not to a run.** A single
 * "last swept at" would be applied to every query in the next run, including
 * one added or reworded since — and that query has never seen the archive, so
 * restricting it to the delta window would skip every page it would have found
 * and report a clean nothing. So the state is keyed by label **and** by the
 * `q` that was sent: change the wording and the query is treated as new, which
 * is the conservative direction. It costs a full sweep of one query; the other
 * direction costs a silent miss.
 * ---------------------------------------------------------------------------
 */

export interface SweptQuery {
  /** The `q` string this mark belongs to. A different `q` is a different query. */
  q: string;
  /** ISO date of the last successful sweep of this exact query. */
  lastSweptAt: string;
}

export interface SweepRun {
  at: string;
  querySetVersion: string;
  requests: number;
  candidates: number;
  /** Null when the run did not chain the free verification stage. */
  brandHits: number | null;
}

export interface SweepState {
  queries: Record<string, SweptQuery>;
  runs: SweepRun[];
}

export function emptySweepState(): SweepState {
  return { queries: {}, runs: [] };
}

/**
 * The vendor's date-range syntax, `YYYY-MM-DDtoYYYY-MM-DD`.
 *
 * The window opens on the day of the last sweep rather than the day after:
 * a page published that day may have been indexed after the run, and paying
 * one day of overlap is cheaper than missing a page for good.
 */
export function freshnessWindow(lastSweptAt: string, today: string): string {
  return `${lastSweptAt.slice(0, 10)}to${today.slice(0, 10)}`;
}

export interface FreshnessPlan {
  label: string;
  /** The `freshness` value to send, or null to sweep this query unrestricted. */
  freshness: string | null;
  /** Why, in words the run prints — this is a spend decision, so it is shown. */
  reason: string;
}

/**
 * Decides, per query, whether this run may restrict itself to what is new.
 *
 * Never guesses: a query gets a window only when the state holds a mark for
 * that exact label **and** that exact `q`.
 */
export function planFreshness(
  queries: { label: string; q: string }[],
  state: SweepState,
  today: string,
): FreshnessPlan[] {
  return queries.map((query) => {
    const mark = state.queries[query.label];
    if (mark === undefined) {
      return { label: query.label, freshness: null, reason: "never swept — full archive" };
    }
    if (mark.q !== query.q) {
      return {
        label: query.label,
        freshness: null,
        reason: "reworded since the last sweep — full archive",
      };
    }
    return {
      label: query.label,
      freshness: freshnessWindow(mark.lastSweptAt, today),
      reason: `new since ${mark.lastSweptAt.slice(0, 10)}`,
    };
  });
}

/**
 * Advances the marks of the queries that actually succeeded.
 *
 * Takes only the labels the caller confirms returned HTTP 200, for the Track A
 * reason: a mark that moves after a failure turns a missed window into a window
 * nobody will ever look at again.
 */
export function advanceMarks(
  state: SweepState,
  succeeded: { label: string; q: string }[],
  at: string,
): SweepState {
  const queries = { ...state.queries };
  for (const query of succeeded) {
    queries[query.label] = { q: query.q, lastSweptAt: at };
  }
  return { ...state, queries };
}
