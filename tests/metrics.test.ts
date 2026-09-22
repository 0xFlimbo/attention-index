import { describe, expect, it } from "vitest";
import { getAttentionMetrics } from "../src/lib/metrics/attention";
import { getAmplificationMetrics } from "../src/lib/metrics/amplification";
import { getMediaMetrics } from "../src/lib/metrics/media";
import type { Post } from "../src/schemas/post.schema";
import type { Amplification } from "../src/schemas/amplification.schema";
import type { MediaReference } from "../src/schemas/media.schema";

function makePost(overrides: Partial<Post> & { id: string; views: number }): Post {
  const { views, ...rest } = overrides;
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
        views,
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
    ...rest,
  };
}

function makeAmplification(
  overrides: Partial<Amplification> & { id: string },
): Amplification {
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

describe("getAttentionMetrics — threshold boundaries", () => {
  it.each([
    [999_999, 0, 0, 0],
    [1_000_000, 1, 0, 0],
    [4_999_999, 1, 0, 0],
    [5_000_000, 1, 1, 0],
    [9_999_999, 1, 1, 0],
    [10_000_000, 1, 1, 1],
  ])("views=%i -> over1M=%i over5M=%i over10M=%i", (views, over1M, over5M, over10M) => {
    const metrics = getAttentionMetrics([makePost({ id: "post-a", views })]);
    expect(metrics.postsOver1M).toBe(over1M);
    expect(metrics.postsOver5M).toBe(over5M);
    expect(metrics.postsOver10M).toBe(over10M);
  });
});

describe("getAttentionMetrics — eligibility", () => {
  it("excludes archived, needs_review and _placeholder posts", () => {
    const posts = [
      makePost({ id: "post-verified", views: 2_000_000 }),
      makePost({ id: "post-archived", views: 9_000_000, status: "archived" }),
      makePost({ id: "post-needs-review", views: 9_000_000, status: "needs_review" }),
      makePost({
        id: "post-placeholder",
        views: 9_000_000,
        status: "needs_review",
        _placeholder: true,
      }),
    ];
    const metrics = getAttentionMetrics(posts);
    expect(metrics.trackedPostCount).toBe(1);
    expect(metrics.totalObservedViews).toBe(2_000_000);
    expect(metrics.topPost?.post.id).toBe("post-verified");
  });

  it("returns zeroed metrics and a null topPost for an empty dataset", () => {
    const metrics = getAttentionMetrics([]);
    expect(metrics).toEqual({
      trackedPostCount: 0,
      postsOver1M: 0,
      postsOver5M: 0,
      postsOver10M: 0,
      totalObservedViews: 0,
      topPost: null,
    });
  });

  it("breaks a views tie by earliest published_at, then smallest id", () => {
    const posts = [
      makePost({ id: "post-late", views: 4_500_000, published_at: "2026-09-13" }),
      makePost({ id: "post-early", views: 4_500_000, published_at: "2026-06-07" }),
    ];
    const metrics = getAttentionMetrics(posts);
    expect(metrics.topPost?.post.id).toBe("post-early");
  });

  it("falls back to smallest id when views and published_at both tie", () => {
    const posts = [
      makePost({ id: "post-b", views: 3_000_000, published_at: "2026-05-01" }),
      makePost({ id: "post-a", views: 3_000_000, published_at: "2026-05-01" }),
    ];
    const metrics = getAttentionMetrics(posts);
    expect(metrics.topPost?.post.id).toBe("post-a");
  });
});

describe("getAmplificationMetrics", () => {
  it("counts only verified, non-placeholder records and unique entities", () => {
    const amps = [
      makeAmplification({ id: "amp-a", entity_name: "Alice", category: "politics" }),
      makeAmplification({ id: "amp-b", entity_name: "Alice", category: "politics" }),
      makeAmplification({ id: "amp-c", entity_name: "Bob", category: "media", status: "needs_review" }),
      makeAmplification({
        id: "amp-d",
        entity_name: "Carol",
        category: "tech",
        status: "needs_review",
        _placeholder: true,
      }),
    ];
    const metrics = getAmplificationMetrics(amps);
    expect(metrics.verifiedAmplificationCount).toBe(2);
    expect(metrics.uniqueAmplifierCount).toBe(1);
    expect(metrics.countsByCategory.politics).toBe(2);
    expect(metrics.countsByCategory.media).toBe(0);
  });
});

describe("getMediaMetrics", () => {
  it("counts only verified references and derives publication totals", () => {
    const refs = [
      makeMedia({ id: "media-a", publication: "Forbes" }),
      makeMedia({ id: "media-b", publication: "Forbes" }),
      makeMedia({ id: "media-c", publication: "Reuters", status: "needs_review" }),
    ];
    const metrics = getMediaMetrics(refs);
    expect(metrics.verifiedMediaReferenceCount).toBe(2);
    expect(metrics.uniquePublicationCount).toBe(1);
    expect(metrics.referencesByPublication.Forbes).toBe(2);
  });

  it("returns zeroed metrics for an empty dataset", () => {
    const metrics = getMediaMetrics([]);
    expect(metrics.verifiedMediaReferenceCount).toBe(0);
    expect(metrics.uniquePublicationCount).toBe(0);
  });
});
