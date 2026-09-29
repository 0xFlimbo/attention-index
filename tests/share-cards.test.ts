/**
 * The /share cards (src/lib/metrics/share-cards.ts).
 *
 * Literal figures are asserted against the frozen 2026-09-20 fixture only, the
 * same split as tests/frozen-dataset.test.ts: the live files are checked by
 * relationship (every card fits a post, carries the account and the cashtag),
 * never by value, so a new record cannot turn this red.
 */
import { describe, expect, it } from "vitest";

import frozenPostsJson from "./fixtures/dataset-2026-09-20/posts.json";
import frozenAmplificationsJson from "./fixtures/dataset-2026-09-20/amplifications.json";
import frozenMediaJson from "./fixtures/dataset-2026-09-20/media.json";

import { postsFileSchema, type Post } from "@/schemas/post.schema";
import { amplificationsFileSchema } from "@/schemas/amplification.schema";
import { mediaFileSchema } from "@/schemas/media.schema";
import { getAmplifications, getMediaReferences, getPosts, getProjectMetadata } from "@/lib/data";
import {
  SHARE_CASHTAG,
  X_POST_LIMIT,
  medianObservedViews,
  postsOver500K,
  selectAmplifiersCard,
  selectDistrictsPostCard,
  selectInvestigationCard,
  selectSiteAndToolsCard,
  selectGovernmentCard,
  selectOfficeholdersCard,
  selectPostsAbove1MCard,
  selectPressCard,
  selectShareCards,
  shareIntentUrl,
  sharePostLength,
  sharePostText,
  type ShareCard,
  type ShareCardInput,
} from "@/lib/metrics/share-cards";

const ACCOUNT = "@LayoffAI";
const AS_OF = "2026-09-20";

const frozen: ShareCardInput = {
  posts: postsFileSchema.parse(frozenPostsJson),
  amplifications: amplificationsFileSchema.parse(frozenAmplificationsJson),
  mediaReferences: mediaFileSchema.parse(frozenMediaJson),
  officialXAccount: ACCOUNT,
};

const live: ShareCardInput = {
  posts: getPosts(),
  amplifications: getAmplifications(),
  mediaReferences: getMediaReferences(),
  officialXAccount: getProjectMetadata().official_x_account,
};

function byId(cards: ShareCard[], id: string): ShareCard {
  const card = cards.find((entry) => entry.id === id);
  if (card === undefined) throw new Error(`no card ${id}`);
  return card;
}

/** A post whose only reading is `views`, verified. */
function postWithViews(id: string, views: number): Post {
  const base = frozen.posts[0]!;
  return {
    ...base,
    id,
    observations: [{ ...base.observations[0]!, views }],
  };
}

describe("share cards — frozen dataset (2026-09-20)", () => {
  const cards = selectShareCards(frozen);

  it("builds every card the dataset supports, in page order", () => {
    // No share, citation or mention act existed yet, so there is no site-and-tools card.
    expect(cards.map((card) => card.id)).toEqual([
      "officeholders",
      "amplifiers",
      "observed-views",
      "cited-work",
      "h1b-data",
      "layoff-data",
      "investigation",
      "press",
      "posts-above-1m",
      "median-post",
      "government",
      "districts-post",
      "newsroom-countries",
      "crossover",
      "named-as-source",
      "top-post",
    ]);
  });

  it("counts officeholders by role: sitting and former Representatives and a governor, nobody else", () => {
    const card = byId(cards, "officeholders");
    // Davidson, Self, Roy, Gill sitting; Greene former; DeSantis governor.
    expect(card.figure).toBe("6");
    expect(card.detail).toBe(
      "4 sitting U.S. Representatives · 1 former U.S. Representative · Governor of Florida",
    );
    // Every act here is a quote, so no "shared" verb appears.
    expect(card.claim).toBe(
      "current and former U.S. officeholders quote-posted @LayoffAI — among them Ron DeSantis, Governor of Florida, and 4 sitting members of Congress",
    );
  });

  it("derives the view figures from the latest reading of each post", () => {
    expect(byId(cards, "observed-views").figure).toBe("43.6M");
    expect(byId(cards, "posts-above-1m").claim).toBe(
      "tracked @LayoffAI posts above 1M observed views, 27 above 500K",
    );
    // 32 posts; the 16th and 17th readings are both 1,000,000.
    expect(byId(cards, "median-post").figure).toBe("1M");
    expect(byId(cards, "top-post").figure).toBe("4.5M");
  });

  it("counts cited work over originals only, and publications among them", () => {
    const card = byId(cards, "cited-work");
    expect(card.figure).toBe("24");
    expect(card.claim).toContain("in 18 publications");
  });

  it("names government departments, not people", () => {
    const card = byId(cards, "government");
    expect(card.figure).toBe("2");
    expect(card.claim).toBe(
      "government accounts quote-posted @LayoffAI, at the Department of Justice and the Department of Labor",
    );
    expect(card.claim).not.toContain("Dhillon");
  });

  it("opens the amplifiers and press cards with their named acts", () => {
    expect(byId(cards, "amplifiers").hook).toBe(
      "Elon Musk replied to @LayoffAI. Members of Congress quote-posted it.",
    );
    expect(byId(cards, "press").hook).toBe("Fox News put the H-1B chart on air, crediting LayoffHedge.");
    expect(byId(cards, "named-as-source").figure).toBe("33");
  });
});

describe("share cards — LayoffHedge's work, frozen dataset (2026-09-20)", () => {
  const cards = selectShareCards(frozen);

  it("counts originals citing each work, and names only publications among them", () => {
    expect(byId(cards, "h1b-data").claim).toBe(
      "original press pieces in 9 publications cite LayoffHedge's H-1B filings data, Newsweek and Fox News among them",
    );
    expect(byId(cards, "h1b-data").figure).toBe("11");
    // IBTimes UK cites the layoff data, so it is named.
    expect(byId(cards, "layoff-data").claim).toBe(
      "original press pieces in 7 publications cite LayoffHedge's layoff data, IBTimes UK among them",
    );
  });

  it("ties the government accounts to the investigation through the post they quoted", () => {
    const card = byId(cards, "investigation");
    expect(card.figure).toBe("4");
    expect(card.hook).toBe("One investigation, two federal offices.");
    expect(card.claim).toBe(
      "newsrooms reported LayoffHedge's investigations. Accounts at the Justice and Labor Departments quote-posted the one on Trine University's international enrollment",
    );
  });

  it("counts every identified account on the districts post, politicians among them", () => {
    const card = byId(cards, "districts-post");
    expect(card.figure).toBe("4");
    expect(card.claim).toBe(
      "identified accounts amplified a single @LayoffAI post on H-1B growth by congressional district, 4 politicians among them",
    );
  });
});

describe("share cards — selectors", () => {
  it("computes the median as the middle reading, or the mean of the two middle ones", () => {
    const odd = [1, 5, 3].map((views, index) => postWithViews(`post-${index}`, views));
    const even = [1, 5, 3, 10].map((views, index) => postWithViews(`post-${index}`, views));
    expect(medianObservedViews(odd)).toBe(3);
    expect(medianObservedViews(even)).toBe(4);
    expect(medianObservedViews([])).toBeNull();
  });

  it("counts 500K inclusively", () => {
    const posts = [499_999, 500_000, 700_000].map((views, index) => postWithViews(`post-${index}`, views));
    expect(postsOver500K(posts)).toBe(2);
  });

  it("builds no card from an empty dataset", () => {
    expect(
      selectShareCards({ posts: [], amplifications: [], mediaReferences: [], officialXAccount: ACCOUNT }),
    ).toEqual([]);
  });

  it("drops a card whose records are gone", () => {
    const withoutPolitics = frozen.amplifications.filter(
      (record) => record.category !== "politics" && record.category !== "government",
    );
    const input = { ...frozen, amplifications: withoutPolitics };
    expect(selectOfficeholdersCard(input, AS_OF)).toBeNull();
    expect(selectGovernmentCard(input, AS_OF)).toBeNull();
  });

  it("ignores records that are not verified", () => {
    const pending = frozen.amplifications.map((record) =>
      record.category === "government" ? { ...record, status: "needs_review" as const } : record,
    );
    expect(selectGovernmentCard({ ...frozen, amplifications: pending }, AS_OF)).toBeNull();
  });

  it("drops a named sentence when its record is gone, and keeps the figure", () => {
    const withoutMusk = frozen.amplifications.filter((record) => record.entity_name !== "Elon Musk");
    const amplifiers = selectAmplifiersCard({ ...frozen, amplifications: withoutMusk }, AS_OF);
    expect(amplifiers?.hook).toBe("Members of Congress quote-posted it.");

    const withoutFox = frozen.mediaReferences.filter((reference) => reference.publication !== "Fox News");
    const press = selectPressCard({ ...frozen, mediaReferences: withoutFox }, AS_OF);
    expect(press?.hook).toBe("Not only crypto media.");
  });

  it("keeps the investigation count when no government account quoted its post", () => {
    const withoutGovernment = frozen.amplifications.filter((record) => record.category !== "government");
    const card = selectInvestigationCard({ ...frozen, amplifications: withoutGovernment }, AS_OF);
    expect(card?.figure).toBe("4");
    expect(card?.hook).toBe("Newsrooms report its investigations.");
    expect(card?.claim).toBe("newsrooms reported LayoffHedge's investigations");
  });

  it("builds the districts card only while its post is verified", () => {
    const withoutPost = frozen.posts.filter((post) => post.id !== "post-layoffai-2087170419027526094");
    expect(selectDistrictsPostCard({ ...frozen, posts: withoutPost }, AS_OF)).toBeNull();
  });

  it("counts accounts that acted on the site, not on a post, and the former members among them", () => {
    expect(selectSiteAndToolsCard(frozen, AS_OF)).toBeNull();
    const card = selectSiteAndToolsCard(live, AS_OF);
    const acts = live.amplifications.filter(
      (record) =>
        record.status === "verified" && ["share", "citation", "mention"].includes(record.action),
    );
    expect(card?.figure).toBe(String(new Set(acts.map((record) => `${record.entity_type}:${record.entity_name.toLowerCase()}`)).size));
  });

  it("does not claim a pattern from a single post above 1M", () => {
    const posts = [2_000_000, 400_000].map((views, index) => postWithViews(`post-${index}`, views));
    expect(selectPostsAbove1MCard({ ...frozen, posts }, AS_OF)).toBeNull();
  });
});

/*
 * docs/EDITORIAL.md §2–§3 and the /share rules (docs/HOMEPAGE.md §18): no reach, no people reached, no
 * endorsement verbs, no hype, no price talk. Matched as whole words,
 * case-insensitive, over everything a card says.
 */
const BANNED = [
  /\breach(ed)?\b/i,
  /\bimpressions?\b/i,
  /\bpeople reached\b/i,
  /\bbacked\b/i,
  /\bendors(e|ed|es|ement)\b/i,
  /\bsupports?\b/i,
  /\bvalidat(e|es|ed|ion)\b/i,
  /\brevolutionary\b/i,
  /\bunstoppable\b/i,
  /\bgame-changing\b/i,
  /\b100x\b/i,
  /\bmass adoption\b/i,
  /\bundervalued\b/i,
  /\bprice\b/i,
  /\bbuy\b/i,
  /\bour\b/i,
  /\binfluence\b/i,
];

describe("share cards — every card, frozen and live", () => {
  for (const [label, input] of [
    ["frozen", frozen],
    ["live", live],
  ] as const) {
    const cards = selectShareCards(input);
    const account = input.officialXAccount;

    it(`${label}: every post fits X's 280 characters, link included`, () => {
      for (const card of cards) {
        expect(sharePostLength(sharePostText(card, account)), card.id).toBeLessThanOrEqual(X_POST_LIMIT);
      }
    });

    it(`${label}: every post carries the account and the cashtag, the page text never the cashtag`, () => {
      for (const card of cards) {
        const text = sharePostText(card, account);
        expect(text, card.id).toContain(account);
        expect(text.endsWith(SHARE_CASHTAG), card.id).toBe(true);
        for (const shown of [card.hook, card.claim, card.detail ?? ""]) {
          expect(shown, card.id).not.toContain(SHARE_CASHTAG);
        }
      }
    });

    it(`${label}: no banned term in any card`, () => {
      for (const card of cards) {
        for (const text of [card.hook, card.claim, card.detail ?? "", sharePostText(card, account)]) {
          for (const pattern of BANNED) expect(text, `${card.id}: ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${label}: every card links to evidence on this site, and the post links there too`, () => {
      for (const card of cards) {
        expect(card.evidenceHref.startsWith("/"), card.id).toBe(true);
        const url = new URL(shareIntentUrl(card, account, "https://attentionindex.org"));
        expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
        expect(url.searchParams.get("url")).toBe(`https://attentionindex.org${card.evidenceHref}`);
        expect(url.searchParams.get("text")).toBe(sharePostText(card, account));
      }
    });
  }
});
