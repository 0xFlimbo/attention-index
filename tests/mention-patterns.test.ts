/**
 * What counts as this project's name on somebody else's page
 * (`src/lib/sweep/mention-patterns.ts`, `docs/TOOLS.md §6`).
 *
 * The case that made this a module is asserted first: the detector was
 * calibrated on `data/media.json`, which comes from the official press page,
 * and the press page never writes the name with a space. The best candidate
 * the 2026-09-22 discovery probe found does. A detector that misses it does
 * not report a wrong record — it reports a silence indistinguishable from
 * "nobody cited us", which is the one failure a discovery sweep cannot afford.
 */
import { describe, expect, it } from "vitest";

import { detectMentions, toText, MENTION_PATTERNS } from "@/lib/sweep/mention-patterns";

describe("detectMentions — the forms the open web actually uses", () => {
  it("finds the spaced form the old pattern list missed (yourNEWS, 2026-06-07)", () => {
    const report = detectMentions(
      "According to Layoff Hedge, about four out of every five new U.S. jobs since early " +
        "2020 have gone to people born outside the United States.",
    );
    expect(report.byPattern["layoffhedge"]).toBe(1);
    expect(report.brand).toBe(true);
  });

  it("still finds the closed form, the domain and the handle", () => {
    const report = detectMentions(
      "LayoffHedge (layoffhedge.com) published the figure; @LayoffAI posted the card.",
    );
    // "LayoffHedge" and "layoffhedge.com" are two matches of the brand word.
    expect(report.byPattern["layoffhedge"]).toBe(2);
    expect(report.byPattern["layoffai"]).toBe(1);
    expect(report.brand).toBe(true);
  });

  it("finds a hyphenated or dotted spelling, which a slug and a domain produce", () => {
    expect(detectMentions("https://example.com/tag/layoff-hedge/").brand).toBe(true);
    expect(detectMentions("layoff.hedge").brand).toBe(true);
  });

  it("reports an x.com embed link, where the name is only in the URL", () => {
    const report = detectMentions("Source: https://x.com/LayoffAI/status/2087170419027526094");
    expect(report.byPattern["layoffai"]).toBe(1);
    expect(report.brand).toBe(true);
  });
});

describe("detectMentions — weak forms are kept apart from brand forms", () => {
  it("does not call the account's display name a brand hit on its own", () => {
    // "official layoff" is also ordinary prose in layoff reporting, which is
    // why a page matching only this is a page to read, not a reference.
    const report = detectMentions("The company has not released the official layoff numbers.");
    expect(report.total).toBe(1);
    expect(report.byPattern["official-layoff"]).toBe(1);
    expect(report.brand).toBe(false);
  });

  it('does not call "layoff AI" spaced a brand hit either', () => {
    const report = detectMentions("Their layoff AI tool drafts the notices.");
    expect(report.brand).toBe(false);
    expect(report.byPattern["layoff-ai-spaced"]).toBe(1);
  });

  it("counts the closed handle as strong and never double-counts it as spaced", () => {
    const report = detectMentions("@LayoffAI said so.");
    expect(report.byPattern["layoffai"]).toBe(1);
    expect(report.byPattern["layoff-ai-spaced"]).toBe(0);
  });

  it("reports nothing on a page about layoffs that never names the project", () => {
    const report = detectMentions(
      "Amazon confirmed 14,000 corporate layoffs this week, citing an AI-driven restructuring.",
    );
    expect(report.total).toBe(0);
    expect(report.brand).toBe(false);
  });
});

describe("detectMentions — the excerpt is the thing a human reads", () => {
  it("returns the sentence around the match, not just a count", () => {
    const text = `${"filler ".repeat(60)}As LayoffHedge reported, the figure held.${" tail".repeat(60)}`;
    const [first] = detectMentions(text).excerpts;
    expect(first).toContain("As LayoffHedge reported");
    expect(first?.startsWith("…")).toBe(true);
  });

  it("caps the excerpts, so a page naming us forty times stays readable", () => {
    const report = detectMentions("layoffhedge ".repeat(40));
    expect(report.byPattern["layoffhedge"]).toBe(40);
    expect(report.excerpts.length).toBeLessThanOrEqual(5);
  });
});

describe("the pattern list itself", () => {
  it("documents why every form is in it — the list is read before it is trusted", () => {
    for (const pattern of MENTION_PATTERNS) {
      expect(pattern.why.length).toBeGreaterThan(20);
      expect(pattern.regex.flags).toContain("g");
      expect(pattern.regex.flags).toContain("i");
    }
  });
});

describe("toText", () => {
  it("drops markup, script and style so a hit is a hit in the prose", () => {
    expect(
      toText("<p>As <b>LayoffHedge</b> reported</p><script>var layoffhedge = 1;</script>"),
    ).toBe("As LayoffHedge reported");
  });
});
