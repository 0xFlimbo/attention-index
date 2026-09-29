import { describe, expect, it } from "vitest";
import {
  creditedPublisher,
  dateFromUrl,
  extractArticleMetadata,
  metadataFromMsnDetail,
  metadataLines,
  msnContentUrl,
  readPublicationDate,
} from "../src/lib/sweep/page-metadata";

// Shapes taken from pages read while verifying media records, 2026-09-29,
// trimmed to the fields the module reads. No network in these tests.

const ldJson = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

/** The Yoast shape: one `@graph`, names reached through `@id` references. */
const TENNESSEE_STAR_URL =
  "https://tennesseestar.com/economy/report-oracle-has-only-created-a-net-gain-of-seven-jobs-in-nashville-since-headquarters-relocation/zschmidt/2026/04/22/";
const tennesseeStarHtml = `<html><head>${ldJson({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${TENNESSEE_STAR_URL}#article`,
      author: [{ "@id": "https://tennesseestar.com/#/schema/person/afa674" }],
      headline: "Report: Oracle Has Only Created a Net Gain of Seven Jobs in Nashville",
      datePublished: "2026-04-23T01:40:56+00:00",
      publisher: { "@id": "https://tennesseestar.com/#organization" },
    },
    { "@type": "WebPage", "@id": TENNESSEE_STAR_URL },
    { "@type": "Organization", "@id": "https://tennesseestar.com/#organization", name: "The Tennessee Star" },
    { "@type": "Person", "@id": "https://tennesseestar.com/#/schema/person/afa674", name: "Zachery Schmidt" },
  ],
})}</head><body></body></html>`;

/** Two blocks stating the same moment, once in UTC and once in the newsroom's offset. */
const AMERICAN_BAZAAR_URL =
  "https://americanbazaaronline.com/2026/09/02/amazon-layoffs-hit-washington-121-jobs-to-be-cut-487446/";
const americanBazaarHtml = `<html><head>
<meta property="og:site_name" content="The American Bazaar" />
${ldJson({
  "@graph": [
    {
      "@type": "Article",
      author: { name: "Shubhangi Chowdhury" },
      datePublished: "2026-09-02T14:07:22+00:00",
      publisher: { "@id": "https://mbo.atn.mybluehost.me/#organization" },
    },
    { "@type": "Organization", "@id": "https://mbo.atn.mybluehost.me/#organization", name: "The American Bazaar" },
  ],
})}
${ldJson({
  "@type": "Article",
  datePublished: "2026-09-02T10:07:22-04:00",
  publisher: { "@type": "Organization", name: "The American Bazaar" },
})}</head></html>`;

/** A republication whose page shows a teaser and keeps the full piece in its metadata. */
const NEWSBREAK_URL =
  "https://www.newsbreak.com/news/4884215870312-trine-university-faces-scrutiny-over-foreign-student-recruitment";
const newsBreakHtml = `<html><head>
<meta property="og:site_name" content="NewsBreak"/>
${ldJson({ "@type": "BreadcrumbList", itemListElement: [] })}
${ldJson({
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: "Trine University faces scrutiny over foreign student recruitment - NewsBreak",
  dateCreated: "2026-09-13T23:46:53.000Z",
  datePublished: "2026-09-13T23:46:53.000Z",
  author: { "@type": "Person", name: "Jayujyoti Mullick" },
  articleBody:
    "<body><div><p>The investigation, published by LayoffHedge and highlighted in a post by LayoffAI on X, says…</p></div></body>",
  publisher: { "@type": "Organization", name: "The American Bazaar", url: "https://americanbazaaronline.com" },
})}</head></html>`;

describe("extractArticleMetadata", () => {
  it("resolves @id references inside a @graph (the Yoast shape)", () => {
    const metadata = extractArticleMetadata(tennesseeStarHtml);
    expect(metadata).toMatchObject({
      publishedAt: "2026-04-23T01:40:56+00:00",
      author: "Zachery Schmidt",
      publisher: "The Tennessee Star",
      source: "json-ld",
    });
  });

  it("prefers a timestamp in the newsroom's own offset over the same moment in UTC", () => {
    expect(extractArticleMetadata(americanBazaarHtml)?.publishedAt).toBe("2026-09-02T10:07:22-04:00");
  });

  it("reads the credited publisher and the article body a teaser page keeps in its metadata", () => {
    const metadata = extractArticleMetadata(newsBreakHtml);
    expect(metadata?.publisher).toBe("The American Bazaar");
    expect(metadata?.siteName).toBe("NewsBreak");
    expect(metadata?.author).toBe("Jayujyoti Mullick");
    expect(metadata?.articleBody).toContain("published by LayoffHedge");
    expect(metadata?.articleBody).not.toContain("<p>");
  });

  it("falls back to meta tags when the page carries no article JSON-LD", () => {
    const html = `<head>
      <meta property="og:site_name" content="Example Daily" />
      <meta name="article:published_time" content="2026-05-01T09:00:00-05:00" />
      <meta name="author" content="A. Writer" />
    </head>`;
    expect(extractArticleMetadata(html)).toMatchObject({
      publishedAt: "2026-05-01T09:00:00-05:00",
      author: "A. Writer",
      siteName: "Example Daily",
      publisher: null,
      source: "meta",
    });
  });

  it("skips a malformed JSON-LD block without losing the others", () => {
    const html = `<script type="application/ld+json">{ not json</script>${ldJson({
      "@type": "NewsArticle",
      datePublished: "2026-07-06T19:16:00+05:30",
    })}`;
    expect(extractArticleMetadata(html)?.publishedAt).toBe("2026-07-06T19:16:00+05:30");
  });

  it("returns null for a page that states nothing about itself", () => {
    expect(extractArticleMetadata("<html><body><p>No metadata.</p></body></html>")).toBeNull();
  });
});

describe("dateFromUrl", () => {
  it("reads a /YYYY/MM/DD/ path, and nothing else", () => {
    expect(dateFromUrl(TENNESSEE_STAR_URL)).toBe("2026-04-22");
    expect(dateFromUrl(AMERICAN_BAZAAR_URL)).toBe("2026-09-02");
    expect(dateFromUrl(NEWSBREAK_URL)).toBeNull();
    expect(dateFromUrl("https://example.com/2026/13/40/story")).toBeNull();
  });
});

describe("readPublicationDate", () => {
  it("flags a UTC timestamp near midnight that disagrees with the URL (the Tennessee Star case)", () => {
    const reading = readPublicationDate(extractArticleMetadata(tennesseeStarHtml), TENNESSEE_STAR_URL);
    expect(reading.proposed).toBe("2026-04-23");
    expect(reading.urlDate).toBe("2026-04-22");
    expect(reading.flags).toHaveLength(2);
  });

  it("proposes the day in the newsroom's offset without a flag when the URL agrees", () => {
    const reading = readPublicationDate(extractArticleMetadata(americanBazaarHtml), AMERICAN_BAZAAR_URL);
    expect(reading).toEqual({ proposed: "2026-09-02", urlDate: "2026-09-02", flags: [] });
  });

  it("says so when there is no timestamp at all", () => {
    expect(readPublicationDate(null, NEWSBREAK_URL).flags).toEqual([
      "no publication timestamp in the page's metadata",
    ]);
  });
});

describe("creditedPublisher", () => {
  it("names an outlet other than the site's own — the likely syndicated_from", () => {
    expect(creditedPublisher(extractArticleMetadata(newsBreakHtml), NEWSBREAK_URL)).toBe("The American Bazaar");
  });

  it("recognises the site itself by its host when the page has no og:site_name", () => {
    expect(creditedPublisher(extractArticleMetadata(tennesseeStarHtml), TENNESSEE_STAR_URL)).toBeNull();
    expect(creditedPublisher(extractArticleMetadata(americanBazaarHtml), AMERICAN_BAZAAR_URL)).toBeNull();
  });
});

describe("MSN", () => {
  it("maps an ar- article URL to MSN's content endpoint, keeping its locale", () => {
    expect(
      msnContentUrl(
        "https://www.msn.com/en-in/money/news/trump-tightened-h-1b-visa-rules-then-renewals-hit-record-high/ar-AA27a2x3",
      ),
    ).toBe("https://assets.msn.com/content/view/v2/Detail/en-in/AA27a2x3");
  });

  it("refuses a gm- item and any other host", () => {
    expect(
      msnContentUrl("https://www.msn.com/en-gb/news/other/daily-wire-cuts-staff-as-shapiros-youtube-views-plunge-85/gm-GM62A728C9"),
    ).toBeNull();
    expect(msnContentUrl("https://www.notmsn.com/en-us/news/ar-AA1")).toBeNull();
    expect(msnContentUrl("not a url")).toBeNull();
  });

  it("reads provider, timestamp and body from the endpoint's answer", () => {
    const metadata = metadataFromMsnDetail({
      title: "Trump tightened H-1B visa rules, then renewals hit record high",
      publishedDateTime: "2026-07-03T18:22:14Z",
      provider: { name: "NDTV World" },
      authors: [{ name: "Edited by Anushree Jonko" }],
      body: "<p>LayoffHedge, based on USCIS data, found that 273,026 petitions…</p>",
    });
    expect(metadata).toMatchObject({
      publishedAt: "2026-07-03T18:22:14Z",
      publisher: "NDTV World",
      siteName: "MSN",
      source: "msn",
    });
    expect(metadata?.articleBody).toBe("LayoffHedge, based on USCIS data, found that 273,026 petitions…");
    expect(
      creditedPublisher(metadata, "https://www.msn.com/en-in/money/news/x/ar-AA27a2x3"),
    ).toBe("NDTV World");
  });

  it("returns null for an answer with neither body nor provider", () => {
    expect(metadataFromMsnDetail({ title: "x" })).toBeNull();
    expect(metadataFromMsnDetail("410 Gone")).toBeNull();
  });
});

describe("metadataLines", () => {
  it("prints the date with its source, the credited publisher and every flag", () => {
    const lines = metadataLines(extractArticleMetadata(newsBreakHtml), NEWSBREAK_URL);
    expect(lines[0]).toContain("2026-09-13");
    expect(lines.some((line) => line.includes("credited publisher  The American Bazaar"))).toBe(true);
    expect(lines.some((line) => line.startsWith("CHECK"))).toBe(true);
  });
});
