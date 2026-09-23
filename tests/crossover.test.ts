import { describe, expect, it } from "vitest";
import {
  compareAmplifierOrder,
  selectAmplifiers,
  selectCrossoverCategories,
  AMPLIFICATION_CATEGORY_LABELS,
  AMPLIFICATION_ACTION_LABELS,
} from "../src/lib/metrics/amplification";
import { getAmplifications } from "../src/lib/data/amplifications";
import {
  amplificationActionEnum,
  amplificationCategoryEnum,
  type Amplification,
  type AmplificationCategory,
} from "../src/schemas/amplification.schema";

function makeAmplification(
  overrides: Partial<Amplification> & { id: string; category: AmplificationCategory },
): Amplification {
  return {
    entity_type: "person",
    entity_name: "Test Entity",
    role: null,
    organization: null,
    action: "quote_post",
    date: "2026-01-01",
    platform: "x",
    account: "@test",
    evidence_url: "https://x.com/test/status/1",
    related_post_id: null,
    follower_count: null,
    follower_count_observed_at: null,
    country: null,
    featured: false,
    portrait: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-02",
    ...overrides,
  };
}

describe("selectCrossoverCategories — real dataset", () => {
  const amplifications = getAmplifications();
  const categories = selectCrossoverCategories(amplifications);

  it("derives each category's count independently from the raw records, not from another selector's output", () => {
    for (const category of amplificationCategoryEnum.options) {
      const expectedCount = amplifications.filter(
        (amp) => amp.status === "verified" && amp._placeholder !== true && amp.category === category,
      ).length;
      const entry = categories.find((c) => c.category === category);
      expect(entry?.count ?? 0).toBe(expectedCount);
    }
  });

  it("excludes zero-count categories entirely", () => {
    const zeroCategories = amplificationCategoryEnum.options.filter(
      (category) => !categories.some((entry) => entry.category === category),
    );
    for (const category of zeroCategories) {
      const rawCount = amplifications.filter(
        (amp) => amp.status === "verified" && amp._placeholder !== true && amp.category === category,
      ).length;
      expect(rawCount).toBe(0);
    }
    // The complement of the check above, and the reason this assertion is a
    // relationship rather than the list of four categories it used to name:
    // A discovery sweep exists to put records into journalism, media and business,
    // so a literal set here fails on exactly the record such a sweep is hunting
    // for. The dated literal is kept against frozen
    // input in `tests/frozen-dataset.test.ts`.
    const nonEmpty = amplificationCategoryEnum.options.filter(
      (category) =>
        amplifications.filter(
          (amp) =>
            amp.status === "verified" && amp._placeholder !== true && amp.category === category,
        ).length > 0,
    );
    expect(categories.map((entry) => entry.category).sort()).toEqual([...nonEmpty].sort());
  });

  it("caps examples at 3 real entity names, in featured-first/date-descending order", () => {
    // politics has 6 verified records today — independently re-sorted here
    // (plain reimplementation, not calling compareAmplifierOrder) so this
    // isn't checking the selector against its own logic.
    const politicsRecords = amplifications.filter(
      (amp) => amp.status === "verified" && amp._placeholder !== true && amp.category === "politics",
    );
    const expectedTop3 = [...politicsRecords]
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        if (a.date !== b.date) return a.date > b.date ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      })
      .slice(0, 3)
      .map((amp) => amp.entity_name);

    const politicsEntry = categories.find((entry) => entry.category === "politics");
    expect(politicsEntry?.examples).toEqual(expectedTop3);
  });
});

describe("selectCrossoverCategories / selectAmplifiers — eligibility", () => {
  it("excludes needs_review and _placeholder records from counts, examples and the amplifier list", () => {
    const amplifications = [
      makeAmplification({ id: "amp-verified", category: "media", entity_name: "Verified Entity" }),
      makeAmplification({
        id: "amp-needs-review",
        category: "media",
        entity_name: "Unreviewed Entity",
        status: "needs_review",
        verified_at: null,
      }),
      makeAmplification({
        id: "amp-placeholder",
        category: "media",
        entity_name: "Placeholder Entity",
        status: "needs_review",
        verified_at: null,
        _placeholder: true,
      }),
    ];

    const categories = selectCrossoverCategories(amplifications);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.count).toBe(1);
    expect(categories[0]?.examples).toEqual(["Verified Entity"]);

    const amplifiers = selectAmplifiers(amplifications);
    expect(amplifiers.map((amp) => amp.id)).toEqual(["amp-verified"]);
  });
});

describe("compareAmplifierOrder / selectAmplifiers — sort order", () => {
  it("sorts featured first, then date descending", () => {
    const amplifications = [
      makeAmplification({ id: "amp-old-featured", category: "media", date: "2026-01-01", featured: true }),
      makeAmplification({ id: "amp-new-unfeatured", category: "media", date: "2026-06-01", featured: false }),
      makeAmplification({ id: "amp-new-featured", category: "media", date: "2026-06-01", featured: true }),
    ];
    const sorted = selectAmplifiers(amplifications);
    expect(sorted.map((amp) => amp.id)).toEqual([
      "amp-new-featured",
      "amp-old-featured",
      "amp-new-unfeatured",
    ]);
  });

  it("breaks a genuine tie (same featured, same date) by smallest id", () => {
    const amplifications = [
      makeAmplification({ id: "amp-zzz-tie", category: "media", date: "2026-05-01", featured: true }),
      makeAmplification({ id: "amp-aaa-tie", category: "media", date: "2026-05-01", featured: true }),
    ];
    expect(compareAmplifierOrder(amplifications[0]!, amplifications[1]!)).toBeGreaterThan(0);
    expect(selectAmplifiers(amplifications).map((amp) => amp.id)).toEqual([
      "amp-aaa-tie",
      "amp-zzz-tie",
    ]);
  });
});

describe("label maps — exhaustiveness", () => {
  it("AMPLIFICATION_CATEGORY_LABELS covers every category enum member with a non-empty label", () => {
    for (const category of amplificationCategoryEnum.options) {
      expect(typeof AMPLIFICATION_CATEGORY_LABELS[category]).toBe("string");
      expect(AMPLIFICATION_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
    expect(Object.keys(AMPLIFICATION_CATEGORY_LABELS).sort()).toEqual(
      [...amplificationCategoryEnum.options].sort(),
    );
  });

  it("AMPLIFICATION_ACTION_LABELS covers every action enum member with a non-empty label", () => {
    for (const action of amplificationActionEnum.options) {
      expect(typeof AMPLIFICATION_ACTION_LABELS[action]).toBe("string");
      expect(AMPLIFICATION_ACTION_LABELS[action].length).toBeGreaterThan(0);
    }
    expect(Object.keys(AMPLIFICATION_ACTION_LABELS).sort()).toEqual(
      [...amplificationActionEnum.options].sort(),
    );
  });

  it("never upgrades a weak interaction (docs/EDITORIAL.md §5) — spot-check the exact mapping", () => {
    expect(AMPLIFICATION_ACTION_LABELS.repost).toBe("REPOSTED");
    expect(AMPLIFICATION_ACTION_LABELS.quote_post).toBe("QUOTE-POSTED");
    expect(AMPLIFICATION_ACTION_LABELS.reply).toBe("REPLIED TO");
    expect(AMPLIFICATION_ACTION_LABELS.mention).toBe("MENTIONED");
    expect(AMPLIFICATION_ACTION_LABELS.share).toBe("SHARED");
    expect(AMPLIFICATION_ACTION_LABELS.citation).toBe("CITED");
    expect(AMPLIFICATION_ACTION_LABELS.interview).toBe("INTERVIEWED");
    expect(AMPLIFICATION_ACTION_LABELS.other).toBe("REFERENCED");
  });
});

describe("empty dataset", () => {
  it("selectCrossoverCategories returns an empty array, no throw", () => {
    expect(selectCrossoverCategories([])).toEqual([]);
  });

  it("selectAmplifiers returns an empty array, no throw", () => {
    expect(selectAmplifiers([])).toEqual([]);
  });
});
