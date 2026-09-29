import { describe, expect, it } from "vitest";
import {
  compareAmplifierOrder,
  amplifierIdentity,
  selectAmplifierGroups,
  selectAmplifiers,
  selectCrossoverCategories,
  AMPLIFICATION_CATEGORY_LABELS,
  AMPLIFICATION_ACTION_LABELS,
} from "../src/lib/metrics/amplification";
import { getAmplifications } from "../src/lib/data/amplifications";
import { getMediaReferences } from "../src/lib/data/media";
import { toAmplifierCardData } from "../src/components/amplifier-card";
import { amplifierAnchorId } from "../src/components/amplified-by";
import {
  amplificationActionEnum,
  amplificationCategoryEnum,
  type Amplification,
  type AmplificationCategory,
} from "../src/schemas/amplification.schema";
import type { MediaReference } from "../src/schemas/media.schema";

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

function makeMediaReference(
  overrides: Partial<MediaReference> & { id: string; publication: string },
): MediaReference {
  return {
    title: "Test title",
    reference_type: "article",
    published_at: "2026-01-01",
    url: `https://example.com/${overrides.id}`,
    author: null,
    country: null,
    provenance: "original",
    syndicated_from: null,
    cited_work: "none",
    context: null,
    related_post_id: null,
    featured: false,
    logo: null,
    archive_url: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-02",
    ...overrides,
  };
}

describe("selectCrossoverCategories — the media node reads both files", () => {
  const outletOnX = makeAmplification({
    id: "amp-tennessee-star",
    category: "media",
    entity_type: "organization",
    entity_name: "Tennessee Star",
  });

  it("counts an outlet in both files once, whatever the leading article", () => {
    const media = [makeMediaReference({ id: "media-star", publication: "The Tennessee Star" })];
    const [entry] = selectCrossoverCategories([outletOnX], media);
    expect(entry?.category).toBe("media");
    expect(entry?.count).toBe(1);
    expect(entry?.examples).toEqual(["The Tennessee Star"]);
  });

  it("counts a publication's several references, and its republications, as one outlet each", () => {
    const media = [
      makeMediaReference({ id: "media-a-1", publication: "Outlet A" }),
      makeMediaReference({ id: "media-a-2", publication: "Outlet A" }),
      makeMediaReference({
        id: "media-b-1",
        publication: "Outlet B",
        provenance: "syndicated",
        syndicated_from: "Outlet A",
      }),
    ];
    const [entry] = selectCrossoverCategories([outletOnX], media);
    expect(entry?.count).toBe(3);
  });

  it("does not count a needs_review, archived or placeholder media record", () => {
    const media = [
      makeMediaReference({ id: "media-verified", publication: "Verified Outlet" }),
      makeMediaReference({
        id: "media-needs-review",
        publication: "Unreviewed Outlet",
        status: "needs_review",
        verified_at: null,
      }),
      makeMediaReference({ id: "media-archived", publication: "Archived Outlet", status: "archived" }),
      makeMediaReference({
        id: "media-placeholder",
        publication: "Placeholder Outlet",
        status: "needs_review",
        verified_at: null,
        _placeholder: true,
      }),
    ];
    const [entry] = selectCrossoverCategories([], media);
    expect(entry?.count).toBe(1);
    expect(entry?.examples).toEqual(["Verified Outlet"]);
  });

  it("draws the media node from the press alone, and leaves every other node to X", () => {
    const person = makeAmplification({ id: "amp-person", category: "politics", entity_name: "Person" });
    const media = [makeMediaReference({ id: "media-only", publication: "Press Only" })];
    expect(
      selectCrossoverCategories([person], media).map((entry) => [entry.category, entry.count]),
    ).toEqual([
      ["politics", 1],
      ["media", 1],
    ]);
  });

  it("names publications first, in Public References order, then outlets known only from X", () => {
    const media = [
      makeMediaReference({ id: "media-small", publication: "Small Outlet" }),
      makeMediaReference({ id: "media-large-1", publication: "Large Outlet" }),
      makeMediaReference({ id: "media-large-2", publication: "Large Outlet" }),
    ];
    const xOnly = makeAmplification({
      id: "amp-x-only",
      category: "media",
      entity_type: "organization",
      entity_name: "X Only Outlet",
      date: "2026-09-01",
    });
    const [entry] = selectCrossoverCategories([xOnly, outletOnX], media);
    expect(entry?.count).toBe(4);
    expect(entry?.examples).toEqual(["Large Outlet", "Small Outlet", "X Only Outlet"]);
  });
});

describe("selectCrossoverCategories — real dataset", () => {
  const amplifications = getAmplifications();
  const mediaReferences = getMediaReferences();
  const categories = selectCrossoverCategories(amplifications, mediaReferences);

  // Plain reimplementation of the counting rule, not a call to the selector or
  // to `outletIdentity`: people by entity type + name, and for `media` outlets
  // by name with a leading "The", case and punctuation dropped, across both files.
  function expectedMembers(category: AmplificationCategory): Set<string> {
    const outlet = (name: string) => name.toLowerCase().replace(/^the /, "").replace(/[^a-z0-9]/g, "");
    const verifiedAmps = amplifications.filter(
      (amp) => amp.status === "verified" && amp._placeholder !== true && amp.category === category,
    );
    if (category !== "media") {
      return new Set(verifiedAmps.map((amp) => `${amp.entity_type}:${amp.entity_name.toLowerCase()}`));
    }
    return new Set([
      ...verifiedAmps.map((amp) => outlet(amp.entity_name)),
      ...mediaReferences
        .filter((reference) => reference.status === "verified" && reference._placeholder !== true)
        .map((reference) => outlet(reference.publication)),
    ]);
  }

  it("derives each category's count independently from the raw records, not from another selector's output", () => {
    for (const category of amplificationCategoryEnum.options) {
      const entry = categories.find((c) => c.category === category);
      expect(entry?.count ?? 0).toBe(expectedMembers(category).size);
    }
  });

  it("excludes zero-count categories entirely", () => {
    // A relationship rather than the list of categories it used to name: a
    // discovery sweep exists to put records into journalism, media and
    // business, so a literal set here fails on exactly the record such a sweep
    // is hunting for. The dated literal is kept against frozen input in
    // `tests/frozen-dataset.test.ts`.
    const nonEmpty = amplificationCategoryEnum.options.filter(
      (category) => expectedMembers(category).size > 0,
    );
    expect(categories.map((entry) => entry.category)).toEqual(nonEmpty);
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
      .map((amp) => amp.entity_name)
      .filter((name, index, names) => names.indexOf(name) === index)
      .slice(0, 3);

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

    const categories = selectCrossoverCategories(amplifications, []);
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
    expect(selectCrossoverCategories([], [])).toEqual([]);
  });

  it("selectAmplifiers returns an empty array, no throw", () => {
    expect(selectAmplifiers([])).toEqual([]);
  });
});

describe("one person, several acts — docs/DATA.md §6 counting rule", () => {
  const personAOlder = makeAmplification({
    id: "amp-person-a-1",
    category: "public_figure",
    entity_name: "Person A",
    date: "2026-08-12",
    evidence_url: "https://x.com/a/status/1",
  });
  const personANewer = makeAmplification({
    id: "amp-person-a-2",
    category: "public_figure",
    entity_name: "Person A",
    date: "2026-09-21",
    evidence_url: "https://x.com/a/status/2",
    follower_count: 1480934,
    follower_count_observed_at: "2026-09-27",
  });
  const other = makeAmplification({
    id: "amp-person-b",
    category: "public_figure",
    entity_name: "Person B",
    date: "2026-09-01",
  });
  const amplifications = [personAOlder, other, personANewer];

  it("Crossover counts the person once and never repeats the name among the examples", () => {
    const [entry] = selectCrossoverCategories(amplifications, []);
    expect(entry?.count).toBe(2);
    expect(entry?.examples).toEqual(["Person A", "Person B"]);
  });

  it("groups every act of a person into one group, newest act first", () => {
    const groups = selectAmplifierGroups(amplifications);
    expect(groups.map((group) => group.identity)).toEqual([
      amplifierIdentity(personANewer),
      amplifierIdentity(other),
    ]);
    expect(groups[0]?.records.map((record) => record.id)).toEqual(["amp-person-a-2", "amp-person-a-1"]);
  });

  it("orders groups by the person's strongest record, so a featured act lifts the whole card", () => {
    const featuredOld = { ...personAOlder, featured: true };
    const groups = selectAmplifierGroups([other, personANewer, featuredOld]);
    expect(groups.map((group) => group.records.length)).toEqual([2, 1]);
    expect(groups[0]?.identity).toBe(amplifierIdentity(personANewer));
  });

  it("the /evidence list still has one row per act", () => {
    expect(selectAmplifiers(amplifications)).toHaveLength(3);
  });

  it("the card lists every act and takes the follower count from the newest act", () => {
    const [group] = selectAmplifierGroups(amplifications);
    const card = toAmplifierCardData(group!, new Map(), "@LayoffAI");
    expect(card.acts.map((act) => act.evidenceUrl)).toEqual([
      "https://x.com/a/status/2",
      "https://x.com/a/status/1",
    ]);
    expect(card.followerCount).toBe(1480934);
    expect(card.followerCountObservedAt).toBe("2026-09-27");
  });

  it("names the X account for an act on a post and the project for anything else", () => {
    const acts = (["quote_post", "reply", "repost", "share", "citation", "mention"] as const).map(
      (action, index) =>
        makeAmplification({ id: `amp-act-${index}`, category: "politics", entity_name: "Actor", action }),
    );
    const [group] = selectAmplifierGroups(acts);
    const card = toAmplifierCardData(group!, new Map(), "@LayoffAI");
    const targets = Object.fromEntries(
      card.acts.map((act) => [acts.find((a) => a.id === act.id)!.action, act.target]),
    );
    // A quote of an untracked @LayoffAI post (related_post_id null) is still on the account.
    expect(targets).toEqual({
      quote_post: "@LayoffAI",
      reply: "@LayoffAI",
      repost: "@LayoffAI",
      share: "LayoffHedge",
      citation: "LayoffHedge",
      mention: "LayoffHedge",
    });
  });

  it("shows a follower count on public_figure only — for any other category the role is the point", () => {
    const officeholder = makeAmplification({
      id: "amp-officeholder",
      category: "politics",
      entity_name: "Officeholder",
      follower_count: 500000,
      follower_count_observed_at: "2026-09-27",
    });
    const [group] = selectAmplifierGroups([officeholder]);
    const card = toAmplifierCardData(group!, new Map(), "@LayoffAI");
    expect(card.followerCount).toBeNull();
    expect(card.followerCountObservedAt).toBeNull();
  });
});

describe("amplifierAnchorId — one link target per card", () => {
  it("slugs the name", () => {
    expect(amplifierAnchorId("Harmeet K. Dhillon")).toBe("amplifier-harmeet-k-dhillon");
    expect(amplifierAnchorId("U.S. Department of Labor Office of Inspector General")).toBe(
      "amplifier-u-s-department-of-labor-office-of-inspector-general",
    );
  });

  it("is unique across every card the real dataset renders", () => {
    const ids = selectAmplifierGroups(getAmplifications()).map((group) =>
      amplifierAnchorId(group.records[0]!.entity_name),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
