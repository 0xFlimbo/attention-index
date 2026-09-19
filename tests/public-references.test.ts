import { describe, expect, it } from "vitest";
import { selectPublicationReferences } from "../src/lib/metrics/media";
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
 * first two B13 ordering keys tie and the original count equals the total —
 * they exercise keys 3 to 5 exactly as they did before B13. Keys 1 and 2
 * have their own cases in `tests/media-contract.test.ts`.
 */
describe("selectPublicationReferences — ordering", () => {
  it("orders groups by reference count, descending (ordering key 3, once original and featured counts tie)", () => {
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
});
