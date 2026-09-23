/**
 * The two indexes `pnpm sweep:web` can ask (`src/lib/sweep/web-vendors.ts`,
 * `docs/TOOLS.md §10`).
 *
 * What is pinned here is what was measured on 2026-09-23 and would cost a
 * credit or a silent miss to get wrong: the free tier's page size, the date
 * window Google takes, the absence of a "more results" flag, and that the two
 * vendors never share a ledger or a state file.
 */
import { describe, expect, it } from "vitest";

import {
  WEB_VENDORS,
  readSerperNews,
  serperCredits,
  serperNewsBody,
  serperTbs,
  webVendor,
} from "@/lib/sweep/web-vendors";
import { allQueryLabels } from "@/lib/sweep/web-queries";

describe("webVendor", () => {
  it("defaults to Brave, so an unqualified run behaves as it always did", () => {
    expect(webVendor(null)?.id).toBe("brave-web");
  });

  it("returns null for an unknown vendor rather than guessing one", () => {
    expect(webVendor("serper-search")).toBeNull();
  });

  it("never lets two vendors share a ledger or a --since-last state file", () => {
    const vendors = Object.values(WEB_VENDORS);
    expect(new Set(vendors.map((vendor) => vendor.ledgerFile)).size).toBe(vendors.length);
    expect(new Set(vendors.map((vendor) => vendor.stateFile)).size).toBe(vendors.length);
  });

  it("skips only labels that exist, each with the measurement behind it", () => {
    for (const vendor of Object.values(WEB_VENDORS)) {
      for (const [label, reason] of Object.entries(vendor.refusedLabels)) {
        expect(allQueryLabels()).toContain(label);
        expect(reason).toMatch(/\d{4}-\d{2}-\d{2}/);
      }
    }
  });

  it("keeps Brave's existing files where they are", () => {
    expect(WEB_VENDORS["brave-web"].ledgerFile).toBe("brave-search-ledger.json");
    expect(WEB_VENDORS["brave-web"].stateFile).toBe("web-sweep-state.json");
  });
});

describe("serperNewsBody", () => {
  it("asks for 10 — the free tier answers num 20 with HTTP 400", () => {
    expect(serperNewsBody("q", 1, null).num).toBe(10);
  });

  it("omits page on the first page and sends it 1-based after", () => {
    expect(serperNewsBody("q", 1, null)).not.toHaveProperty("page");
    expect(serperNewsBody("q", 2, null).page).toBe(2);
  });

  it("turns autocorrect off, so an exact figure is not rewritten", () => {
    expect(serperNewsBody('"273,026" H-1B renewals', 1, null).autocorrect).toBe(false);
  });

  it("sends tbs only when there is a window", () => {
    expect(serperNewsBody("q", 1, null)).not.toHaveProperty("tbs");
    expect(serperNewsBody("q", 1, "qdr:w").tbs).toBe("qdr:w");
  });
});

describe("serperTbs", () => {
  it("never sends Google's custom range — /news echoes it and ignores it", () => {
    // Measured 2026-09-23: a one-day cdr window returned articles four months
    // old; qdr:w on the same query returned only that day's.
    expect(serperTbs("2026-09-03to2026-10-01")).not.toMatch(/^cdr/);
  });

  it("rounds a --since-last range up to the smallest bucket that contains it", () => {
    expect(serperTbs("2026-09-23to2026-09-23")).toBe("qdr:w");
    expect(serperTbs("2026-09-23to2026-09-28")).toBe("qdr:w");
    expect(serperTbs("2026-09-23to2026-10-01")).toBe("qdr:m");
    expect(serperTbs("2026-09-23to2026-12-01")).toBe("qdr:y");
  });

  it("sweeps unrestricted when the gap is longer than any bucket", () => {
    expect(serperTbs("2025-01-01to2026-09-23")).toBeNull();
  });

  it("passes the vendor's own syntax through untouched", () => {
    expect(serperTbs("qdr:m")).toBe("qdr:m");
  });

  it("returns null for no window", () => {
    expect(serperTbs(null)).toBeNull();
  });
});

describe("readSerperNews", () => {
  const item = { title: "t", link: "https://example.com/a" };

  it("treats only a full page as a reason to buy the next one", () => {
    // There is no more_results_available on this vendor; a full page is the
    // only signal, and it can be wrong — measured once, at a credit's cost.
    expect(readSerperNews({ news: Array(10).fill(item) }).morePossible).toBe(true);
    expect(readSerperNews({ news: Array(7).fill(item) }).morePossible).toBe(false);
  });

  it("reads an error body as no items rather than throwing", () => {
    const read = readSerperNews({ message: "Query pattern not allowed for free accounts.", statusCode: 400 });
    expect(read.items).toEqual([]);
    expect(read.morePossible).toBe(false);
  });
});

describe("serperCredits", () => {
  it("reads the vendor's own per-request cost, and says so when it is absent", () => {
    expect(serperCredits({ news: [], credits: 1 })).toBe(1);
    expect(serperCredits({ news: [] })).toBeNull();
  });
});
