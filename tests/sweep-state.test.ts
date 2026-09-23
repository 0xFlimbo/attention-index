/**
 * The web sweep's high-water marks (`src/lib/sweep/sweep-state.ts`,
 * `docs/TOOLS.md §10`).
 *
 * Same two failure modes Track A's `since_id` has — a mark that moves
 * backwards re-buys a paid window, a mark that moves after a failure hides one
 * forever — plus a third this state has to handle that Track A does not: a
 * query set changes, and a window applied to a query that has never seen the
 * archive reports a clean nothing while skipping everything.
 */
import { describe, expect, it } from "vitest";

import {
  advanceMarks,
  emptySweepState,
  freshnessWindow,
  planFreshness,
  type SweepState,
} from "@/lib/sweep/sweep-state";

const swept: SweepState = {
  queries: {
    "brand-closed": { q: "layoffhedge -site:layoffhedge.com", lastSweptAt: "2026-09-22T16:00:00.000Z" },
  },
  runs: [],
};

describe("freshnessWindow", () => {
  it("builds the vendor's date range and overlaps by a day on purpose", () => {
    // A page published on the day of the last run may have been indexed after
    // it. One day of overlap is cheaper than missing a page permanently.
    expect(freshnessWindow("2026-09-22T16:00:00.000Z", "2026-10-22T09:00:00.000Z")).toBe(
      "2026-09-22to2026-10-22",
    );
  });
});

describe("planFreshness", () => {
  it("restricts a query that has been swept before under the same wording", () => {
    const [plan] = planFreshness(
      [{ label: "brand-closed", q: "layoffhedge -site:layoffhedge.com" }],
      swept,
      "2026-10-22T09:00:00.000Z",
    );
    expect(plan?.freshness).toBe("2026-09-22to2026-10-22");
  });

  it("sweeps a new query unrestricted — it has never seen the archive", () => {
    const [plan] = planFreshness(
      [{ label: "brand-new", q: "something else" }],
      swept,
      "2026-10-22T09:00:00.000Z",
    );
    expect(plan?.freshness).toBeNull();
    expect(plan?.reason).toContain("never swept");
  });

  it("treats a reworded query as new, which is the conservative direction", () => {
    // Costs one full sweep of one query. The other direction costs a silent
    // miss, and this project has already had one of those from a reworded
    // query (the Trine calibration target).
    const [plan] = planFreshness(
      [{ label: "brand-closed", q: "layoffhedge" }],
      swept,
      "2026-10-22T09:00:00.000Z",
    );
    expect(plan?.freshness).toBeNull();
    expect(plan?.reason).toContain("reworded");
  });
});

describe("advanceMarks", () => {
  it("moves only the queries handed to it, and records what was sent", () => {
    const next = advanceMarks(
      emptySweepState(),
      [{ label: "brand-closed", q: "layoffhedge" }],
      "2026-10-22T09:00:00.000Z",
    );
    expect(next.queries["brand-closed"]).toEqual({
      q: "layoffhedge",
      lastSweptAt: "2026-10-22T09:00:00.000Z",
    });
  });

  it("leaves a query that did not succeed exactly where it was", () => {
    // The caller passes only the labels that answered 200. A mark that moves
    // after a failure turns a missed window into one nobody looks at again.
    const next = advanceMarks(swept, [], "2026-10-22T09:00:00.000Z");
    expect(next.queries["brand-closed"]?.lastSweptAt).toBe("2026-09-22T16:00:00.000Z");
  });
});
