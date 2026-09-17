import { describe, expect, it } from "vitest";
import { selectDatasetSummary, type SelectDatasetSummaryInput } from "../src/lib/metrics/dataset";
import { compareMediaOrder, selectMediaReferences } from "../src/lib/metrics/media";
import { getPosts } from "../src/lib/data/posts";
import { getAmplifications } from "../src/lib/data/amplifications";
import { getMediaReferences } from "../src/lib/data/media";
import { getMilestones } from "../src/lib/data/milestones";
import type { MediaReference } from "../src/schemas/media.schema";

/** Plain reimplementation of the shared eligibility rule — never calling `isVerifiedRecord` itself. */
function isVerified(record: { status: string; _placeholder?: boolean }): boolean {
  return record.status === "verified" && record._placeholder !== true;
}

function makeMediaReference(
  overrides: Partial<MediaReference> & { id: string; published_at: string },
): MediaReference {
  return {
    publication: "Test Publication",
    title: "Test title",
    reference_type: "article",
    url: "https://example.com/article",
    author: null,
    country: null,
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

describe("selectDatasetSummary — real dataset", () => {
  const input: SelectDatasetSummaryInput = {
    posts: getPosts(),
    amplifications: getAmplifications(),
    mediaReferences: getMediaReferences(),
    milestones: getMilestones(),
  };
  const rows = selectDatasetSummary(input);

  it("derives each row's count independently from the raw records, not from another selector's output", () => {
    const expectedPosts = input.posts.filter(isVerified).length;
    const expectedAmplifications = input.amplifications.filter(isVerified).length;
    const expectedMedia = input.mediaReferences.filter(isVerified).length;
    const expectedMilestones = input.milestones.filter(isVerified).length;

    expect(rows.find((row) => row.key === "posts")?.count).toBe(expectedPosts);
    expect(rows.find((row) => row.key === "amplifications")?.count).toBe(expectedAmplifications);
    expect(rows.find((row) => row.key === "media")?.count).toBe(expectedMedia);
    expect(rows.find((row) => row.key === "milestones")?.count).toBe(expectedMilestones);
  });

  it("excludes needs_review and _placeholder media records — 100 raw records, only 18 verified", () => {
    expect(input.mediaReferences.length).toBe(100);
    expect(rows.find((row) => row.key === "media")?.count).toBe(18);
  });

  it("gives the zero-count milestones row a row (not omitted) but a null href", () => {
    expect(input.milestones.filter(isVerified).length).toBe(0);
    const milestonesRow = rows.find((row) => row.key === "milestones");
    expect(milestonesRow).toBeDefined();
    expect(milestonesRow?.count).toBe(0);
    expect(milestonesRow?.href).toBeNull();
  });

  it("gives every non-zero row a /evidence#<key> href", () => {
    for (const row of rows) {
      if (row.count > 0) {
        expect(row.href).toBe(`/evidence#${row.key}`);
      } else {
        expect(row.href).toBeNull();
      }
    }
  });

  it("keeps a fixed row order: posts, amplifications, media, milestones", () => {
    expect(rows.map((row) => row.key)).toEqual(["posts", "amplifications", "media", "milestones"]);
  });
});

describe("selectDatasetSummary — empty datasets", () => {
  const emptyInput: SelectDatasetSummaryInput = {
    posts: [],
    amplifications: [],
    mediaReferences: [],
    milestones: [],
  };
  const rows = selectDatasetSummary(emptyInput);

  it("still returns all four rows, each with count 0 and href null", () => {
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.count).toBe(0);
      expect(row.href).toBeNull();
    }
  });

  it("keeps the fixed row order even when every count is zero", () => {
    expect(rows.map((row) => row.key)).toEqual(["posts", "amplifications", "media", "milestones"]);
  });
});

describe("selectDatasetSummary — row order is independent of which datasets have records", () => {
  it("keeps posts/amplifications/media/milestones order when only media and milestones have records", () => {
    const input: SelectDatasetSummaryInput = {
      posts: [],
      amplifications: [],
      mediaReferences: [makeMediaReference({ id: "media-a", published_at: "2026-01-01" })],
      milestones: [],
    };
    const rows = selectDatasetSummary(input);
    expect(rows.map((row) => row.key)).toEqual(["posts", "amplifications", "media", "milestones"]);
    expect(rows.find((row) => row.key === "media")?.count).toBe(1);
    expect(rows.find((row) => row.key === "media")?.href).toBe("/evidence#media");
  });
});

describe("compareMediaOrder / selectMediaReferences — sort order", () => {
  it("sorts published_at descending", () => {
    const references = [
      makeMediaReference({ id: "media-old", published_at: "2026-01-01" }),
      makeMediaReference({ id: "media-new", published_at: "2026-06-01" }),
      makeMediaReference({ id: "media-mid", published_at: "2026-03-01" }),
    ];
    const sorted = selectMediaReferences(references);
    expect(sorted.map((ref) => ref.id)).toEqual(["media-new", "media-mid", "media-old"]);
  });

  it("breaks a genuine tie (same published_at) by smallest id", () => {
    const references = [
      makeMediaReference({ id: "media-zzz-tie", published_at: "2026-05-01" }),
      makeMediaReference({ id: "media-aaa-tie", published_at: "2026-05-01" }),
    ];
    expect(compareMediaOrder(references[0]!, references[1]!)).toBeGreaterThan(0);
    expect(selectMediaReferences(references).map((ref) => ref.id)).toEqual([
      "media-aaa-tie",
      "media-zzz-tie",
    ]);
  });

  it("excludes needs_review and _placeholder records", () => {
    const references = [
      makeMediaReference({ id: "media-verified", published_at: "2026-01-01" }),
      makeMediaReference({
        id: "media-needs-review",
        published_at: "2026-02-01",
        status: "needs_review",
        verified_at: null,
      }),
      makeMediaReference({
        id: "media-placeholder",
        published_at: "2026-03-01",
        status: "needs_review",
        verified_at: null,
        _placeholder: true,
      }),
    ];
    expect(selectMediaReferences(references).map((ref) => ref.id)).toEqual(["media-verified"]);
  });

  it("returns an empty array for an empty dataset, no throw", () => {
    expect(selectMediaReferences([])).toEqual([]);
  });
});
