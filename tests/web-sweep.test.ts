/**
 * The decisions the web sweep makes before a human spends time on a result
 * (`src/lib/sweep/web-search-results.ts`, `src/lib/sweep/url-list.ts`,
 * `src/lib/sweep/web-queries.ts`, `docs/ENGINEERING.md §21`).
 *
 * All of it is pure, and none of it promotes anything: the sweep reports, a
 * human writes the record. What these tests protect is the two ways a sweep
 * wastes the expensive resource — showing the reader a page the dataset
 * already holds, and showing them a surface that carries no reporting of its
 * own, which was three of the first six probe queries on 2026-09-22.
 */
import { describe, expect, it } from "vitest";

import {
  buildKnownUrlIndex,
  classifyResult,
  countByVerdict,
  dedupeResults,
  normalizeUrl,
  type WebSearchResult,
} from "@/lib/sweep/web-search-results";
import { parseUrlList } from "@/lib/sweep/url-list";
import {
  COMPANY_STORIES,
  QUERY_SET_VERSION,
  SWEEP_QUERIES,
  selectQueries,
} from "@/lib/sweep/web-queries";

function result(url: string, overrides: Partial<WebSearchResult> = {}): WebSearchResult {
  return {
    title: "A headline",
    url,
    query: "layoffhedge",
    queryLabel: "brand-closed",
    ...overrides,
  };
}

describe("normalizeUrl", () => {
  it("gives one spelling to the same page, so a diff against media.json works", () => {
    expect(normalizeUrl("https://www.Example.com/article/")).toBe("example.com/article");
    expect(normalizeUrl("http://example.com/article#intro")).toBe("example.com/article");
  });

  it("drops tracking parameters, which split one page into many", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&fbclid=y")).toBe("example.com/a");
  });

  it("keeps a real query parameter — ?p=1234 is a permalink on small publishers", () => {
    expect(normalizeUrl("https://example.com/?p=1234")).toBe("example.com?p=1234");
  });

  it("survives a malformed URL rather than throwing mid-sweep", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("classifyResult", () => {
  const known = buildKnownUrlIndex([
    { url: "https://www.newsweek.com/h1b-visa-filings-surging-texas-123" },
  ]);

  it("recognises a page already in the dataset, however it is spelled", () => {
    const classified = classifyResult(
      result("https://newsweek.com/h1b-visa-filings-surging-texas-123/?utm_source=brave"),
      known,
    );
    expect(classified.verdict).toBe("known");
  });

  it("recognises the project's own surfaces — finding us is finding nothing", () => {
    expect(classifyResult(result("https://layoffhedge.com/company/coinbase"), known).verdict).toBe(
      "self",
    );
    expect(
      classifyResult(result("https://x.com/LayoffAI/status/2087170419027526094"), known).verdict,
    ).toBe("self");
  });

  it("flags a distribution surface for archiving on sight, and says why", () => {
    const classified = classifyResult(result("https://twitterscore.io/en/layoffai/"), known);
    expect(classified.verdict).toBe("no_reporting");
    expect(classified.reason).toContain("archive on sight");
  });

  it("archives a link-in-bio or mirror surface, each of which hit on the brand word", () => {
    // Measured on the first full sweep: linktr.ee, urlscan.io, threadreaderapp
    // and a token price page all carry the name and report nothing. A page
    // where the string really is there is the most expensive false positive.
    for (const url of [
      "https://linktr.ee/layoffhedge",
      "https://urlscan.io/domain/layoffhedge.com",
      "https://threadreaderapp.com/user/LayoffAI",
      "https://www.coingecko.com/en/coins/official-layoff-coin",
    ]) {
      expect(classifyResult(result(url), known).verdict).toBe("no_reporting");
    }
  });

  it("leaves a syndicating outlet a candidate — a syndication is still a record", () => {
    // NewsBreak carries The American Bazaar's Trine piece: syndicated under
    // the media record contract (docs/DATA.md §7), not a link surface. Blanket-excluding the host would
    // have lost one of the two candidates the 2026-09-22 probe confirmed.
    expect(classifyResult(result("https://www.newsbreak.com/news/trine-1234"), known).verdict).toBe(
      "candidate",
    );
  });

  it("calls an unknown outlet a candidate and sends the reader to the page", () => {
    const classified = classifyResult(result("https://yournews.com/2026/06/07/jobs/"), known);
    expect(classified.verdict).toBe("candidate");
    expect(classified.host).toBe("yournews.com");
  });
});

describe("dedupeResults", () => {
  it("keeps one row per page and the query that found it first", () => {
    const known = buildKnownUrlIndex([]);
    const rows = dedupeResults([
      classifyResult(result("https://yournews.com/a", { queryLabel: "jobs-foreign-born-4-in-5" }), known),
      classifyResult(result("https://www.yournews.com/a/", { queryLabel: "brand-spaced" }), known),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.queryLabel).toBe("jobs-foreign-born-4-in-5");
  });

  it("counts by verdict, which is the whole summary line", () => {
    const known = buildKnownUrlIndex([]);
    const counts = countByVerdict([
      classifyResult(result("https://yournews.com/a"), known),
      classifyResult(result("https://layoffhedge.com/"), known),
    ]);
    expect(counts).toEqual({ self: 1, known: 0, no_reporting: 0, candidate: 1 });
  });
});

describe("parseUrlList — the --urls input", () => {
  it("reads one URL per line, with comments and blank lines ignored", () => {
    const { targets } = parseUrlList(
      ["# a comment", "", "https://yournews.com/a  yourNEWS", "https://newsbreak.com/b"].join("\n"),
    );
    expect(targets).toHaveLength(2);
    expect(targets[0]?.publication).toBe("yourNEWS");
    // No label given, so the host is the label — a report needs a name.
    expect(targets[1]?.publication).toBe("newsbreak.com");
  });

  it("gives each target a readable, unique id — it names the saved text file", () => {
    const { targets } = parseUrlList(["https://yournews.com/a", "https://yournews.com/b"].join("\n"));
    expect(targets[0]?.id).toBe("url-01-yournews-com");
    expect(targets[1]?.id).toBe("url-02-yournews-com");
  });

  it("drops a repeated URL, which otherwise reads as two candidates", () => {
    const { targets } = parseUrlList(["https://yournews.com/a", "https://yournews.com/a"].join("\n"));
    expect(targets).toHaveLength(1);
  });

  it("reports a line it could not use instead of silently skipping it", () => {
    const { targets, skipped } = parseUrlList("yournews.com/a\nhttps://ok.com/b");
    expect(targets).toHaveLength(1);
    expect(skipped).toEqual([{ line: 1, text: "yournews.com/a" }]);
  });
});

describe("the query set", () => {
  it("is versioned, because two runs of different queries are not comparable", () => {
    expect(QUERY_SET_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("carries a brand control as well as claim queries", () => {
    // The brand query returned zero candidates in the probe and is kept anyway:
    // it is how a zero-candidate run is told apart from an index that has
    // never heard of us.
    const clusters = new Set(SWEEP_QUERIES.map((query) => query.cluster));
    expect(clusters.has("brand")).toBe(true);
    expect(clusters.size).toBeGreaterThan(1);
  });

  it("leaves the unproven Spanish query out of the default set", () => {
    expect(SWEEP_QUERIES.some((query) => query.cluster === "unproven")).toBe(false);
    expect(selectQueries(["es-brand"]).queries.map((query) => query.label)).toEqual(["es-brand"]);
  });

  it("matches a label exactly — a substring selector billed twice what was asked", () => {
    // Measured 2026-09-22: `--query investigation-trine` also matched
    // `investigation-trine-backdoor`, so a one-query probe made two requests.
    const selected = selectQueries(["investigation-trine"]);
    expect(selected.queries.map((query) => query.label)).toEqual(["investigation-trine"]);
    expect(selected.unknown).toEqual([]);
  });

  it("reports an unknown label rather than selecting nothing silently", () => {
    const selected = selectQueries(["not-a-query"]);
    expect(selected.queries).toEqual([]);
    expect(selected.unknown).toEqual(["not-a-query"]);
  });

  it("takes several labels in one flag, comma-separated", () => {
    const selected = selectQueries(["brand-closed,brand-spaced"]);
    expect(selected.queries.map((query) => query.label)).toEqual(["brand-closed", "brand-spaced"]);
  });

  it("keeps the measured-dead company cluster out of the default set but reachable", () => {
    // Run 2026-09-22 for $0.020: 45 candidates fetched, 0 brand hits, because
    // 43 of the 64 records it targets cite by embedded post rather than in
    // prose. Kept defined so it reads as answered, not as untried.
    const labels = SWEEP_QUERIES.map((query) => query.label);
    for (const query of COMPANY_STORIES) expect(labels).not.toContain(query.label);
    expect(selectQueries(["company-meta-15800"]).queries).toHaveLength(1);
  });

  it("says why every query is worded the way it is", () => {
    for (const query of [...SWEEP_QUERIES, ...COMPANY_STORIES]) {
      expect(query.why.length).toBeGreaterThan(20);
      expect(query.q.trim()).toBe(query.q);
    }
  });
});
