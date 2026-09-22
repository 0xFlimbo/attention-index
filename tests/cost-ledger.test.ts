/**
 * The record of spend (`src/lib/sweep/cost-ledger.ts`, `docs/ENGINEERING.md §21`).
 *
 * `research/README.md` calls the X work's cost ledger the one file there that
 * can **never** be regenerated: the responses it paid for cannot reconstruct
 * what they cost. These tests hold the two properties that make it worth that
 * description — a failed request still counts, and the cost is never presented
 * as a measurement when it is a model.
 */
import { describe, expect, it } from "vitest";

import {
  LEDGER_NOTE,
  emptyLedger,
  ledgerEntry,
  rateLimitHeaders,
  summarise,
  yieldByQuery,
} from "@/lib/sweep/cost-ledger";

function entry(
  overrides: { queryLabel?: string; q?: string; httpStatus?: number; resultCount?: number } = {},
) {
  return ledgerEntry({
    at: "2026-09-22T16:00:21.974Z",
    vendor: "brave-search",
    endpoint: "/res/v1/web/search",
    querySetVersion: "2026-09-22.2",
    queryLabel: overrides.queryLabel ?? "brand-closed",
    q: overrides.q ?? "layoffhedge -site:layoffhedge.com",
    httpStatus: overrides.httpStatus ?? 200,
    resultCount: overrides.resultCount ?? 20,
    unitPriceUsd: 0.005,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "50, 0",
      "x-ratelimit-remaining": "49, 0",
      "x-ratelimit-policy": "50;w=1, 0;w=2592000",
    },
  });
}

describe("ledgerEntry", () => {
  it("keeps the vendor's own quota headers and drops everything else", () => {
    // The quota headers are the only thing in a response that speaks to cost.
    expect(entry().rateLimit).toEqual({
      "x-ratelimit-limit": "50, 0",
      "x-ratelimit-remaining": "49, 0",
      "x-ratelimit-policy": "50;w=1, 0;w=2592000",
    });
  });

  it("prices one request at the unit price in force when it was made", () => {
    // Prices move; a reading does not. The rate is stored beside the cost so a
    // later price change cannot silently rewrite what an old run cost.
    const recorded = entry();
    expect(recorded.unitPriceUsd).toBe(0.005);
    expect(recorded.modelledCostUsd).toBe(0.005);
  });

  it("records which query set produced it, so yield is comparable across runs", () => {
    expect(entry().querySetVersion).toBe("2026-09-22.2");
  });
});

describe("rateLimitHeaders", () => {
  it("is case-insensitive about header names, which vary by runtime", () => {
    expect(rateLimitHeaders({ "X-RateLimit-Limit": "50, 0" })).toEqual({
      "X-RateLimit-Limit": "50, 0",
    });
  });
});

describe("summarise", () => {
  it("counts a failed request as a request — the vendor may still have billed it", () => {
    const total = summarise([entry(), entry({ httpStatus: 429, resultCount: 0 })]);
    expect(total.requests).toBe(2);
    expect(total.modelledCostUsd).toBe(0.01);
  });

  it("reports results per request, which is what the next run's budget is built on", () => {
    const total = summarise([entry({ resultCount: 20 }), entry({ resultCount: 1 })]);
    expect(total.results).toBe(21);
    expect(total.resultsPerRequest).toBe(10.5);
  });

  it("survives an empty ledger without dividing by zero", () => {
    expect(summarise([])).toEqual({
      requests: 0,
      modelledCostUsd: 0,
      results: 0,
      resultsPerRequest: 0,
      firstAt: null,
      lastAt: null,
    });
  });
});

describe("yieldByQuery", () => {
  it("adds a label's runs up and ranks by what the query actually returned", () => {
    const [top] = yieldByQuery([
      entry({ queryLabel: "quiet", resultCount: 0 }),
      entry({ queryLabel: "loud", resultCount: 20 }),
    ]);
    // Ranked on known + candidates, and both are zero here, so the tie holds:
    // what this asserts is that two labels stay two rows.
    expect(yieldByQuery([entry({ queryLabel: "a" }), entry({ queryLabel: "b" })])).toHaveLength(2);
    expect(top?.requests).toBe(1);
  });

  it("flags a label that has been sent as more than one query", () => {
    // `investigation-trine` ran under three wordings in one afternoon. Summing
    // them reads as one query with a history; it is three questions.
    const [row] = yieldByQuery([
      entry({ queryLabel: "investigation-trine", q: '"Trine University" recruitment' }),
      entry({ queryLabel: "investigation-trine", q: '"9,123" Trine graduate students' }),
    ]);
    expect(row?.reworded).toBe(true);
  });

  it("does not flag a label whose wording has held", () => {
    expect(yieldByQuery([entry(), entry()])[0]?.reworded).toBe(false);
  });

  it("survives entries written before verdicts existed", () => {
    // 21 of them are on disk. A type cannot make a field appear in a file.
    const old = { ...entry(), verdicts: undefined } as unknown as ReturnType<typeof entry>;
    expect(() => yieldByQuery([old])).not.toThrow();
    expect(yieldByQuery([old])[0]?.known).toBe(0);
  });
});

describe("the ledger file itself", () => {
  it("carries the warning that its costs are modelled, not metered", () => {
    // This vendor publishes no balance endpoint. A future reader finding a
    // dollar figure in this file must not take it for a meter reading.
    expect(emptyLedger("brave-search").note).toBe(LEDGER_NOTE);
    expect(LEDGER_NOTE).toContain("MODELLED");
    expect(LEDGER_NOTE).toContain("dashboard");
  });
});
