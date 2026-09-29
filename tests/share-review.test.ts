/**
 * `pnpm share:review` (src/lib/metrics/share-review.ts): what drifted from the
 * /share copy as written. Frozen fixture for the drift cases, the live files
 * for the one relationship that must hold on them.
 */
import { describe, expect, it } from "vitest";

import frozenPostsJson from "./fixtures/dataset-2026-09-20/posts.json";
import frozenAmplificationsJson from "./fixtures/dataset-2026-09-20/amplifications.json";
import frozenMediaJson from "./fixtures/dataset-2026-09-20/media.json";

import { postsFileSchema } from "@/schemas/post.schema";
import { amplificationsFileSchema } from "@/schemas/amplification.schema";
import { mediaFileSchema } from "@/schemas/media.schema";
import { getAmplifications, getMediaReferences, getPosts, getProjectMetadata } from "@/lib/data";
import {
  FALLBACK_HOOKS,
  SHARE_CARD_IDS,
  curatedReferences,
  selectShareCards,
  type ShareCardInput,
} from "@/lib/metrics/share-cards";
import { reviewShareCards } from "@/lib/metrics/share-review";

const frozen: ShareCardInput = {
  posts: postsFileSchema.parse(frozenPostsJson),
  amplifications: amplificationsFileSchema.parse(frozenAmplificationsJson),
  mediaReferences: mediaFileSchema.parse(frozenMediaJson),
  officialXAccount: "@LayoffAI",
};

const live: ShareCardInput = {
  posts: getPosts(),
  amplifications: getAmplifications(),
  mediaReferences: getMediaReferences(),
  officialXAccount: getProjectMetadata().official_x_account,
};

describe("share:review", () => {
  it("lists every card id the selectors can build, in page order", () => {
    const built = selectShareCards(live).map((card) => card.id);
    // Every id the page builds is listed, and in the listed order.
    expect(SHARE_CARD_IDS.filter((id) => built.includes(id))).toEqual(built);
  });

  it("reports a card that is not built", () => {
    // No share, citation or mention act existed on 2026-09-20.
    expect(reviewShareCards(frozen).warnings).toContain(
      "site-and-tools: not built — its records are gone or below its floor.",
    );
  });

  it("reports a hook that fell back, and the hand-chosen record behind it", () => {
    const withoutMusk = frozen.amplifications.filter((record) => record.entity_name !== "Elon Musk");
    const input = { ...frozen, amplifications: withoutMusk };
    const warnings = reviewShareCards(input).warnings;
    expect(warnings).toContain("amplifiers: amplification amp-elon-musk-2034731489318048232 not found among verified records.");
    expect(curatedReferences(input).filter((reference) => !reference.found)).toHaveLength(1);

    const withoutFox = frozen.mediaReferences.filter((reference) => reference.publication !== "Fox News");
    const pressWarnings = reviewShareCards({ ...frozen, mediaReferences: withoutFox }).warnings;
    expect(pressWarnings).toContain(`press: hook fell back to "${FALLBACK_HOOKS.press}".`);
    // Fox News also drops out of the H-1B card's names.
    expect(pressWarnings).toContain("h1b-data: publication Fox News citing h1b_data not found among verified records.");
  });

  it("finds every hand-chosen id and name in the live data", () => {
    expect(curatedReferences(live).filter((reference) => !reference.found)).toEqual([]);
  });

  it("gives one row per built card, with the length X will count", () => {
    const review = reviewShareCards(frozen);
    expect(review.rows.map((row) => row.id)).toEqual(selectShareCards(frozen).map((card) => card.id));
    for (const row of review.rows) expect(row.length).toBe(row.text.length + 1 + 23);
  });
});
