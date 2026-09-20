import { describe, expect, it } from "vitest";
import {
  selectPublicationReferences,
  HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT,
} from "../src/lib/metrics/media";
import { getMediaReferences } from "../src/lib/data/media";
import type { MediaReference } from "../src/schemas/media.schema";

function makeMediaReference(
  overrides: Partial<MediaReference> & { id: string; publication: string; published_at: string },
): MediaReference {
  return {
    title: "Test title",
    reference_type: "article",
    url: "https://example.com/article",
    author: null,
    country: null,
    provenance: "original",
    syndicated_from: null,
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

describe("selectPublicationReferences — eligibility", () => {
  it("excludes needs_review and _placeholder records from both the groups and the counts", () => {
    const references = [
      makeMediaReference({ id: "media-a", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({
        id: "media-b",
        publication: "Forbes",
        published_at: "2026-02-01",
        status: "needs_review",
        verified_at: null,
      }),
      makeMediaReference({
        id: "media-c",
        publication: "Newsweek",
        published_at: "2026-03-01",
        status: "needs_review",
        verified_at: null,
        _placeholder: true,
      }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.publication).toBe("Forbes");
    expect(groups[0]?.references.map((ref) => ref.id)).toEqual(["media-a"]);
  });

  it("returns an empty array for an empty dataset", () => {
    expect(selectPublicationReferences([])).toEqual([]);
  });

  it("returns an empty array when every record is needs_review", () => {
    const references = [
      makeMediaReference({
        id: "media-a",
        publication: "Forbes",
        published_at: "2026-01-01",
        status: "needs_review",
        verified_at: null,
      }),
    ];
    expect(selectPublicationReferences(references)).toEqual([]);
  });
});

describe("selectPublicationReferences — grouping and counts", () => {
  it("groups references by publication, verbatim, with correct per-publication counts", () => {
    const references = [
      makeMediaReference({ id: "media-a", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-b", publication: "Forbes", published_at: "2026-02-01" }),
      makeMediaReference({ id: "media-c", publication: "Newsweek", published_at: "2026-03-01" }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups.map((group) => [group.publication, group.references.length])).toEqual([
      ["Forbes", 2],
      ["Newsweek", 1],
    ]);
  });

  it("sorts each group's own references with compareMediaOrder (newest first)", () => {
    const references = [
      makeMediaReference({ id: "media-old", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-new", publication: "Forbes", published_at: "2026-06-01" }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups[0]?.references.map((ref) => ref.id)).toEqual(["media-new", "media-old"]);
  });
});

/**
 * These fixtures are all `provenance: "original"` and unfeatured, so the
 * original count equals the total and the featured key ties — they exercise
 * the reference-count key and the two tie-breaks below it. The provenance
 * and featured keys (2 and 3 after B19) have their own cases in
 * `tests/media-contract.test.ts`.
 */
describe("selectPublicationReferences — ordering", () => {
  it("orders groups by reference count, descending (ordering key 1)", () => {
    const references = [
      makeMediaReference({ id: "media-a", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-b", publication: "Newsweek", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-c", publication: "Newsweek", published_at: "2026-01-02" }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups.map((group) => group.publication)).toEqual(["Newsweek", "Forbes"]);
  });

  it("breaks a tied count by most recent published_at, descending (ordering key 4)", () => {
    const references = [
      makeMediaReference({ id: "media-a", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-b", publication: "Newsweek", published_at: "2026-05-01" }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups.map((group) => group.publication)).toEqual(["Newsweek", "Forbes"]);
  });

  it("breaks a tied count and tied most-recent date by publication ascending (ordering key 5)", () => {
    const references = [
      makeMediaReference({ id: "media-a", publication: "Zeta Media", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-b", publication: "Alpha Press", published_at: "2026-01-01" }),
    ];
    const groups = selectPublicationReferences(references);
    expect(groups.map((group) => group.publication)).toEqual(["Alpha Press", "Zeta Media"]);
  });

  it("is deterministic regardless of input order — a shuffled input produces the same output", () => {
    const inOrderA = [
      makeMediaReference({ id: "media-1", publication: "Forbes", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-2", publication: "Forbes", published_at: "2026-02-01" }),
      makeMediaReference({ id: "media-3", publication: "Newsweek", published_at: "2026-05-01" }),
      makeMediaReference({ id: "media-4", publication: "Alpha Press", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-5", publication: "Zeta Media", published_at: "2026-01-01" }),
    ];
    const inOrderB = [inOrderA[3]!, inOrderA[1]!, inOrderA[4]!, inOrderA[0]!, inOrderA[2]!];

    const groupsA = selectPublicationReferences(inOrderA);
    const groupsB = selectPublicationReferences(inOrderB);

    const shape = (groups: ReturnType<typeof selectPublicationReferences>) =>
      groups.map((group) => [group.publication, group.references.map((ref) => ref.id)]);

    expect(shape(groupsA)).toEqual(shape(groupsB));
    // Forbes leads on count (2). Among the three count-1 publications, Newsweek's
    // 2026-05-01 is the most recent date, so it leads the rest; Alpha Press and
    // Zeta Media then tie on both count and date and fall back to alphabetical.
    expect(groupsA.map((group) => group.publication)).toEqual([
      "Forbes",
      "Newsweek",
      "Alpha Press",
      "Zeta Media",
    ]);
  });
});

describe("selectPublicationReferences — real dataset", () => {
  it("matches today's known shape: 94 eligible references across 51 publications, top group 17", () => {
    const groups = selectPublicationReferences(getMediaReferences());
    expect(groups).toHaveLength(51);
    expect(groups.reduce((sum, group) => sum + group.references.length, 0)).toBe(94);
    expect(groups[0]?.references.length).toBe(17);
  });

  /*
   * The B19 guard, on the real file rather than on fixtures: the defect this
   * batch fixed was only ever visible at 51 rows. Nothing about the number of
   * references is asserted here — only that the column the reader actually
   * sees never steps back up.
   */
  it("prints a right rail that never increases going down the list", () => {
    const counts = selectPublicationReferences(getMediaReferences()).map(
      (group) => group.references.length,
    );
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]!).toBeLessThanOrEqual(counts[index - 1]!);
    }
  });

  it("puts the two groups B14's review found out of place back in count order", () => {
    const order = selectPublicationReferences(getMediaReferences()).map(
      (group) => group.publication,
    );
    // Inkl (8 references, 0 originals) was at row 43, below thirty-odd rows
    // printing "1 reference"; Alex Jones Live (3) was below The National
    // Pulse (2). Both are pinned by position now, not merely by the rail
    // check above.
    expect(order.indexOf("Inkl")).toBe(1);
    expect(order.indexOf("Alex Jones Live")).toBeLessThan(order.indexOf("The National Pulse"));
  });
});

describe("HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT", () => {
  it("caps the homepage section below the full list, which stays reachable on /evidence", () => {
    const groups = selectPublicationReferences(getMediaReferences());
    expect(HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT).toBe(12);
    // A cap that does not cap is the one shape this constant must not have:
    // the section's "Showing N of M publications" sentence would disappear
    // and the reader would be told nothing about a list that is still whole.
    expect(groups.length).toBeGreaterThan(HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT);
  });

  it("keeps every multi-reference publication above the cap today", () => {
    const groups = selectPublicationReferences(getMediaReferences());
    const shown = groups.slice(0, HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT);
    const hidden = groups.slice(HOMEPAGE_PUBLIC_REFERENCE_ROW_COUNT);
    // Not the reason for the number — twelve is the composition this section
    // was reviewed at, not a threshold derived from the data — but a dated
    // reading worth failing loudly if a future import buries a dense group in
    // the hidden tail, which is exactly the Inkl case one level up.
    expect(hidden.every((group) => group.references.length === 1)).toBe(true);
    expect(shown.filter((group) => group.references.length > 1)).toHaveLength(11);
  });
});
