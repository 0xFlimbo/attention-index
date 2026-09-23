import { describe, expect, it } from "vitest";
import { latestObservationDate, dataLastUpdated } from "../src/lib/metrics/last-updated";
import type { Post } from "../src/schemas/post.schema";
import type { Amplification } from "../src/schemas/amplification.schema";
import type { MediaReference } from "../src/schemas/media.schema";

/**
 * docs/DATA.md §10 — the last-update dates are derived from the records, never
 * typed into `project.json`. So what matters here
 * is exactly the same eligibility rule every other metric uses (verified,
 * non-placeholder), and that the "latest" pick is a true max, not the last
 * element in the array or the first file checked.
 */

function makePost(overrides: Partial<Post> & { id: string }): Post {
  return {
    platform: "x",
    account: "@LayoffAI",
    published_at: "2026-01-01",
    title: "Test post",
    subject: null,
    summary: null,
    url: "https://x.com/LayoffAI/status/1",
    status: "verified",
    featured: false,
    tags: [],
    observations: [
      {
        views: 1_000_000,
        likes: null,
        reposts: null,
        replies: null,
        bookmarks: null,
        observed_at: "2026-01-02",
        source: "interface",
      },
    ],
    screenshot: null,
    notes: null,
    verified_at: "2026-01-02",
    ...overrides,
  };
}

function makeAmplification(overrides: Partial<Amplification> & { id: string }): Amplification {
  return {
    entity_type: "person",
    entity_name: "Test Person",
    role: null,
    organization: null,
    category: "other",
    action: "other",
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
    verified_at: "2026-01-01",
    ...overrides,
  };
}

function makeMedia(overrides: Partial<MediaReference> & { id: string }): MediaReference {
  return {
    publication: "Test Publication",
    title: "Test title",
    reference_type: "article",
    published_at: "2026-01-01",
    url: "https://example.com/article",
    author: null,
    country: null,
    provenance: "original",
    cited_work: "none",
    syndicated_from: null,
    context: null,
    related_post_id: null,
    featured: false,
    logo: null,
    archive_url: null,
    notes: null,
    status: "verified",
    verified_at: "2026-01-01",
    ...overrides,
  };
}

describe("latestObservationDate", () => {
  it("returns null for an empty dataset", () => {
    expect(latestObservationDate([])).toBeNull();
  });

  it("picks the latest observed_at across several readings on one post", () => {
    const post = makePost({
      id: "post-a",
      observations: [
        { views: 100, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-01-01", source: "interface" },
        { views: 500, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-03-01", source: "api" },
        { views: 300, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-02-01", source: "interface" },
      ],
    });
    expect(latestObservationDate([post])).toBe("2026-03-01");
  });

  it("takes the max across posts, not just the last post in the array", () => {
    const older = makePost({
      id: "post-a",
      observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-01-01", source: "interface" }],
    });
    const newer = makePost({
      id: "post-b",
      observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-05-01", source: "interface" }],
    });
    expect(latestObservationDate([newer, older])).toBe("2026-05-01");
    expect(latestObservationDate([older, newer])).toBe("2026-05-01");
  });

  it("excludes needs_review, archived and placeholder posts", () => {
    const posts = [
      makePost({
        id: "post-verified",
        observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-01-01", source: "interface" }],
      }),
      makePost({
        id: "post-needs-review",
        status: "needs_review",
        verified_at: null,
        observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-09-01", source: "interface" }],
      }),
      makePost({
        id: "post-archived",
        status: "archived",
        verified_at: null,
        observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-09-02", source: "interface" }],
      }),
      makePost({
        id: "post-placeholder",
        _placeholder: true,
        observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-09-03", source: "interface" }],
      }),
    ];
    // Every excluded post carries a later observed_at than the eligible one —
    // if any of them leaked in, the result would not be 2026-01-01.
    expect(latestObservationDate(posts)).toBe("2026-01-01");
  });
});

describe("dataLastUpdated", () => {
  it("returns null when nothing anywhere is eligible", () => {
    expect(dataLastUpdated([], [], [])).toBeNull();
  });

  it("returns latestObservationDate when it is later than every verified_at", () => {
    const post = makePost({
      id: "post-a",
      verified_at: "2026-01-05",
      observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-06-01", source: "interface" }],
    });
    const amp = makeAmplification({ id: "amp-a", verified_at: "2026-01-05" });
    const media = makeMedia({ id: "media-a", verified_at: "2026-01-05" });
    expect(dataLastUpdated([post], [amp], [media])).toBe("2026-06-01");
  });

  it("returns a later verified_at when it beats every observation", () => {
    const post = makePost({
      id: "post-a",
      verified_at: "2026-01-05",
      observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-01-01", source: "interface" }],
    });
    const amp = makeAmplification({ id: "amp-a", verified_at: "2026-09-23" });
    const media = makeMedia({ id: "media-a", verified_at: "2026-01-05" });
    expect(dataLastUpdated([post], [amp], [media])).toBe("2026-09-23");
  });

  it("takes the max across all three files, not just one", () => {
    const post = makePost({ id: "post-a", verified_at: "2026-01-01" });
    const amp = makeAmplification({ id: "amp-a", verified_at: "2026-02-01" });
    const media = makeMedia({ id: "media-a", verified_at: "2026-03-01" });
    expect(dataLastUpdated([post], [amp], [media])).toBe("2026-03-01");
  });

  it("excludes needs_review, archived and placeholder records in every file", () => {
    const post = makePost({
      id: "post-a",
      verified_at: "2026-01-01",
      observations: [{ views: 1, likes: null, reposts: null, replies: null, bookmarks: null, observed_at: "2026-01-01", source: "interface" }],
    });
    const amps = [
      makeAmplification({ id: "amp-needs-review", status: "needs_review", verified_at: null }),
      makeAmplification({ id: "amp-archived", status: "archived", verified_at: null }),
      makeAmplification({ id: "amp-placeholder", _placeholder: true, verified_at: "2026-12-31" }),
    ];
    const media = [
      makeMedia({ id: "media-needs-review", status: "needs_review", verified_at: null, provenance: null, cited_work: null }),
    ];
    expect(dataLastUpdated([post], amps, media)).toBe("2026-01-01");
  });

  it("ignores a null verified_at on an otherwise-eligible record, falling back to its observation", () => {
    // Schema-invalid in production (§12 requires verified_at on verified
    // records) but the selector must not throw on it, only skip that date —
    // the post's own observation still counts.
    const post = makePost({ id: "post-a", verified_at: null });
    expect(dataLastUpdated([post], [], [])).toBe(latestObservationDate([post]));
  });
});
